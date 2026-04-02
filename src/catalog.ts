import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { resolveProfile, resolveProfileName } from "./config.js";
import { writeError, rawFetch, type RawFetchOpts } from "./api.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NodeParam {
  name: string;
  displayName: string;
  type: string;
  default?: unknown;
  required?: boolean;
  description?: string;
  options?: { name: string; value: string; description?: string }[];
  displayOptions?: Record<string, unknown>;
}

export interface CatalogNode {
  n8nType: string;
  displayName: string;
  category: string;
  description: string;
  version: number[];
  inputs: string[];
  outputs: string[];
  credentials: string[];
  properties: NodeParam[];
  tags: string[];
}

export interface CatalogFile {
  syncedAt: string;
  profileName: string;
  baseUrl: string;
  nodeCount: number;
  nodes: CatalogNode[];
}

// ─── Catalog directory ──────────────────────────────────────────────────────

const CATALOG_DIR = path.join(os.homedir(), ".n8n-cli", "catalog");

function ensureCatalogDir(): void {
  if (!fs.existsSync(CATALOG_DIR)) {
    fs.mkdirSync(CATALOG_DIR, { recursive: true });
  }
}

function catalogPath(profileName: string): string {
  return path.join(CATALOG_DIR, `${profileName}.json`);
}

// ─── Load cached catalog ────────────────────────────────────────────────────

export function loadCatalog(profileName?: string): CatalogFile | null {
  const name = profileName ?? resolveProfileName() ?? "default";
  const p = catalogPath(name);
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw) as CatalogFile;
  } catch {
    return null;
  }
}

function saveCatalog(catalog: CatalogFile): void {
  ensureCatalogDir();
  const name = catalog.profileName;
  fs.writeFileSync(catalogPath(name), JSON.stringify(catalog, null, 2) + "\n", "utf8");
}

// ─── Category detection (from n8n-mcp-claude) ───────────────────────────────

function detectCategory(raw: RawNode): string {
  const name = (raw.name || "").toLowerCase();
  const group = raw.group || [];

  if (group.includes("trigger") || name.includes("trigger") || name.includes("Trigger")) return "trigger";

  // AI nodes
  if (
    name.includes("langchain") ||
    name.includes("openai") ||
    name.includes("ai") ||
    (raw.inputs && JSON.stringify(raw.inputs).includes("ai_"))
  ) return "ai";

  // Transform
  const transforms = ["set", "code", "function", "merge", "splitInBatches", "itemLists", "spreadsheetFile", "xml", "html", "markdown", "convertToFile", "extractFromFile", "crypto", "dateTime", "compression"];
  if (transforms.some((t) => name.includes(t.toLowerCase()))) return "transform";

  // Flow
  const flows = ["if", "switch", "splitInBatches", "loop", "wait", "noOp", "stopAndError", "executeWorkflow", "subWorkflow", "respondToWebhook"];
  if (flows.some((f) => name.includes(f.toLowerCase()))) return "flow";

  // Output
  if (name.includes("respondToWebhook") || name.includes("sendAndWait")) return "output";

  return "action";
}

function extractTags(raw: RawNode): string[] {
  const tags: string[] = [];
  const name = raw.displayName || raw.name || "";

  // From codex categories
  if (raw.codex?.categories) {
    tags.push(...raw.codex.categories.map((c: string) => c.toLowerCase()));
  }

  // From name
  const words = name.replace(/([A-Z])/g, " $1").toLowerCase().split(/[\s_\-./]+/).filter((w) => w.length > 2);
  tags.push(...words);

  // From n8nType package
  const parts = (raw.name || "").split(".");
  if (parts.length > 1) {
    const nodeName = parts[parts.length - 1].replace(/([A-Z])/g, " $1").toLowerCase().trim();
    tags.push(...nodeName.split(/\s+/).filter((w) => w.length > 2));
  }

  return [...new Set(tags)];
}

function extractInputTypes(raw: RawNode): string[] {
  if (!raw.inputs) return ["main"];
  if (typeof raw.inputs === "string") return [raw.inputs];
  return (raw.inputs as unknown[]).map((i) => {
    if (typeof i === "string") return i;
    if (i && typeof i === "object" && "type" in (i as Record<string, unknown>)) return String((i as Record<string, unknown>).type);
    return "main";
  });
}

function extractOutputTypes(raw: RawNode): string[] {
  if (!raw.outputs) return ["main"];
  if (typeof raw.outputs === "string") return [raw.outputs];
  return (raw.outputs as unknown[]).map((o) => {
    if (typeof o === "string") return o;
    if (o && typeof o === "object" && "type" in (o as Record<string, unknown>)) return String((o as Record<string, unknown>).type);
    return "main";
  });
}

function rawToNode(raw: RawNode): CatalogNode {
  const version = Array.isArray(raw.version)
    ? raw.version
    : typeof raw.version === "number"
      ? [raw.version]
      : [1];

  const properties: NodeParam[] = (raw.properties || []).map((p: RawProperty) => ({
    name: p.name,
    displayName: p.displayName || p.name,
    type: p.type || "string",
    ...(p.default !== undefined ? { default: p.default } : {}),
    ...(p.required ? { required: true } : {}),
    ...(p.description ? { description: p.description } : {}),
    ...(p.options?.length ? { options: p.options.map((o: RawOption) => ({ name: o.name, value: String(o.value ?? o.name), ...(o.description ? { description: o.description } : {}) })) } : {}),
    ...(p.displayOptions ? { displayOptions: p.displayOptions } : {}),
  }));

  const credentials = (raw.credentials || []).map((c: RawCredential) => c.name);

  return {
    n8nType: raw.name,
    displayName: raw.displayName || raw.name,
    category: detectCategory(raw),
    description: raw.description || "",
    version,
    inputs: extractInputTypes(raw),
    outputs: extractOutputTypes(raw),
    credentials,
    properties,
    tags: extractTags(raw),
  };
}

// ─── Raw types ──────────────────────────────────────────────────────────────

interface RawOption {
  name: string;
  value?: unknown;
  description?: string;
}

interface RawProperty {
  name: string;
  displayName?: string;
  type?: string;
  default?: unknown;
  required?: boolean;
  description?: string;
  options?: RawOption[];
  displayOptions?: Record<string, unknown>;
}

interface RawCredential {
  name: string;
  required?: boolean;
}

interface RawNode {
  name: string;
  displayName?: string;
  description?: string;
  group?: string[];
  version?: number | number[];
  inputs?: unknown;
  outputs?: unknown;
  properties?: RawProperty[];
  credentials?: RawCredential[];
  codex?: { categories?: string[] };
  defaults?: Record<string, unknown>;
  icon?: string;
}

// ─── Extraction strategies ──────────────────────────────────────────────────

export async function syncCatalog(): Promise<CatalogFile> {
  const profile = resolveProfile();
  const profileName = resolveProfileName() ?? "default";

  if (!profile) {
    writeError({ error: "missing_config", message: "No profile configured." });
    process.exit(2);
  }

  const baseUrl = profile.baseUrl.replace(/\/$/, "");
  const fetchOpts: RawFetchOpts = {
    baseUrl,
    apiKey: profile.apiKey,
    timeout: profile.timeout ?? 30000,
  };

  let rawNodes: RawNode[] = [];

  // Strategy 1: /types/nodes.json (static file, works on most versions)
  if (rawNodes.length === 0) {
    const res = await rawFetch(fetchOpts, "GET", "/types/nodes.json");
    if (res.ok && Array.isArray(res.data)) {
      rawNodes = res.data;
    }
  }

  // Strategy 2: /api/v1/node-types (public API, newer n8n)
  if (rawNodes.length === 0) {
    const res = await rawFetch(fetchOpts, "GET", "/api/v1/node-types");
    if (res.ok) {
      const data = res.data;
      if (Array.isArray(data)) {
        rawNodes = data;
      } else if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).data)) {
        rawNodes = (data as Record<string, unknown>).data as RawNode[];
      }
    }
  }

  // Strategy 3: /rest/node-types (internal API with cookie auth)
  if (rawNodes.length === 0) {
    const res = await rawFetch(fetchOpts, "POST", "/rest/node-types", {});
    if (res.ok) {
      const data = res.data;
      if (Array.isArray(data)) {
        rawNodes = data;
      } else if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).data)) {
        rawNodes = (data as Record<string, unknown>).data as RawNode[];
      }
    }
  }

  // Strategy 4: Fallback — extract unique node types from existing workflows
  if (rawNodes.length === 0) {
    try {
      const allWorkflows: Record<string, unknown>[] = [];
      let cursor: string | undefined;
      do {
        const cursorParam = cursor ? `&cursor=${cursor}` : "";
        const res = await rawFetch(fetchOpts, "GET", `/api/v1/workflows?limit=250${cursorParam}`);
        if (!res.ok) break;
        const body = res.data as Record<string, unknown>;
        if (body && Array.isArray(body.data)) {
          allWorkflows.push(...(body.data as Record<string, unknown>[]));
          cursor = body.nextCursor as string | undefined;
        } else {
          break;
        }
      } while (cursor);

      const nodeMap = new Map<string, RawNode>();
      for (const wf of allWorkflows) {
        const nodes = wf.nodes;
        if (!Array.isArray(nodes)) continue;
        for (const n of nodes) {
          const node = n as Record<string, unknown>;
          const type = String(node.type || "");
          if (type && !nodeMap.has(type)) {
            nodeMap.set(type, {
              name: type,
              displayName: String(node.name || type.split(".").pop() || type),
              description: `Node type extracted from workflow: ${wf.name}`,
              group: [],
              version: typeof node.typeVersion === "number" ? [node.typeVersion as number] : [1],
              inputs: ["main"],
              outputs: ["main"],
              properties: [],
              credentials: [],
            });
          }
        }
      }
      rawNodes = Array.from(nodeMap.values());
    } catch {
      // All strategies failed
    }
  }

  if (rawNodes.length === 0) {
    writeError({
      error: "sync_failed",
      message: "Could not extract node definitions from the n8n instance. Tried: /types/nodes.json, /api/v1/node-types, /rest/node-types, and workflow extraction.",
      hint: "Ensure the instance is reachable and the API key has sufficient permissions.",
    });
    process.exit(1);
  }

  const nodes = rawNodes.map(rawToNode);

  const catalog: CatalogFile = {
    syncedAt: new Date().toISOString(),
    profileName,
    baseUrl,
    nodeCount: nodes.length,
    nodes,
  };

  saveCatalog(catalog);
  return catalog;
}

// ─── Search ─────────────────────────────────────────────────────────────────

export interface SearchResult {
  score: number;
  node: CatalogNode;
}

export function searchNodes(nodes: CatalogNode[], query: string, limit = 10): SearchResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (terms.length === 0) return [];

  const results: SearchResult[] = [];

  for (const node of nodes) {
    let score = 0;
    const nameLower = node.displayName.toLowerCase();
    const typeLower = node.n8nType.toLowerCase();
    const descLower = node.description.toLowerCase();
    const tagsJoined = node.tags.join(" ").toLowerCase();
    const credsJoined = node.credentials.join(" ").toLowerCase();

    for (const term of terms) {
      // Exact match in n8nType or displayName — highest weight
      if (typeLower === term || nameLower === term) {
        score += 100;
      } else if (typeLower.includes(term) || nameLower.includes(term)) {
        score += 50;
      }

      // Tag match
      if (tagsJoined.includes(term)) {
        score += 30;
      }

      // Credential match (e.g. searching "slack" finds slackApi)
      if (credsJoined.includes(term)) {
        score += 20;
      }

      // Description match
      if (descLower.includes(term)) {
        score += 10;
      }
    }

    if (score > 0) {
      results.push({ score, node });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
