import { resolveProfile, resolveProfileName } from "./config.js";

// ─── Client state ───────────────────────────────────────────────────────────

interface ClientConfig {
  baseURL: string;
  apiKey: string;
  timeout: number;
}

let _config: ClientConfig | null = null;

/** Reset the cached client (call when switching profiles) */
export function resetClient(): void {
  _config = null;
}

function getConfig(): ClientConfig {
  if (_config) return _config;

  const profile = resolveProfile();

  if (!profile) {
    const name = resolveProfileName();
    writeError({
      error: "missing_config",
      message: name
        ? `Profile '${name}' not found in config.`
        : "No n8n connection configured.",
      hint: "Set env vars (N8N_BASE_URL + N8N_API_KEY) or run: n8n-cli profile add <name> --base-url <url> --api-key <key>",
    });
    process.exit(2);
  }

  _config = {
    baseURL: `${profile.baseUrl.replace(/\/$/, "")}/api/v1`,
    apiKey: profile.apiKey,
    timeout: profile.timeout ?? 30000,
  };

  return _config;
}

// ─── Core fetch wrapper ─────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  opts?: { body?: unknown; params?: Record<string, unknown> }
): Promise<T> {
  const config = getConfig();
  const url = new URL(`${config.baseURL}${path}`);

  if (opts?.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout);

  try {
    const res = await fetch(url.toString(), {
      method,
      headers: {
        "X-N8N-API-KEY": config.apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let msg = text;
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object" && "message" in parsed) {
          msg = String(parsed.message);
        }
      } catch {}
      writeError({ error: "api_error", status: res.status, message: msg });
      process.exit(1);
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      writeError({ error: "timeout", message: `Request timed out after ${config.timeout}ms: ${method} ${path}` });
      process.exit(1);
    }
    if (err instanceof TypeError) {
      writeError({ error: "network_error", message: `Network error: ${err.message}` });
      process.exit(1);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── HTTP verbs ─────────────────────────────────────────────────────────────

export async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  return request<T>("GET", path, { params });
}

export async function getAll<T extends { data: unknown[]; nextCursor?: string }>(
  path: string,
  params: Record<string, unknown> = {}
): Promise<{ data: T["data"] }> {
  const allData: unknown[] = [];
  let cursor: string | undefined;
  do {
    const p: Record<string, unknown> = { ...params, limit: 250 };
    if (cursor) p.cursor = cursor;
    const page = await get<T>(path, p);
    allData.push(...(page.data as unknown[]));
    cursor = page.nextCursor;
  } while (cursor);
  return { data: allData };
}

export async function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, { body });
}

export async function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PUT", path, { body });
}

export async function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PATCH", path, { body });
}

export async function del<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  return request<T>("DELETE", path, { params });
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Always write errors as JSON to stderr so AI can parse them */
export function writeError(obj: Record<string, unknown>): void {
  process.stderr.write(JSON.stringify(obj) + "\n");
}

/** Apply --fields filter: "id,name,active" → picks only those keys from each item */
export function applyFields(data: unknown, fields?: string): unknown {
  if (!fields) return data;
  const keys = fields.split(",").map((f) => f.trim()).filter(Boolean);
  if (!keys.length) return data;

  const pick = (obj: unknown): unknown => {
    if (Array.isArray(obj)) return obj.map(pick);
    if (obj && typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (const k of keys) {
        if (k in (obj as Record<string, unknown>)) {
          result[k] = (obj as Record<string, unknown>)[k];
        }
      }
      return result;
    }
    return obj;
  };

  // Handle paginated responses
  if (data && typeof data === "object" && "data" in (data as Record<string, unknown>)) {
    const d = data as Record<string, unknown>;
    return { ...d, data: pick(d.data) };
  }
  return pick(data);
}

export function out(data: unknown, fields?: string): void {
  process.stdout.write(JSON.stringify(applyFields(data, fields), null, 2) + "\n");
}

export async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data.trim()));
  });
}

// ─── Raw fetch for non-API paths (catalog sync) ────────────────────────────

export interface RawFetchOpts {
  baseUrl: string;
  apiKey: string;
  timeout: number;
}

/** Fetch a non-API path from the n8n instance (e.g. /types/nodes.json) */
export async function rawFetch(
  opts: RawFetchOpts,
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = `${opts.baseUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "X-N8N-API-KEY": opts.apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) return { ok: false, status: res.status, data: null };
    const data = await res.json();
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  } finally {
    clearTimeout(timer);
  }
}
