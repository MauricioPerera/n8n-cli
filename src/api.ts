import axios, { AxiosInstance, AxiosError } from "axios";
import { resolveProfile, resolveProfileName } from "./config.js";

let _client: AxiosInstance | null = null;

/** Reset the cached client (call when switching profiles) */
export function resetClient(): void {
  _client = null;
}

export function getClient(): AxiosInstance {
  if (_client) return _client;

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

  _client = axios.create({
    baseURL: `${profile.baseUrl.replace(/\/$/, "")}/api/v1`,
    headers: { "X-N8N-API-KEY": profile.apiKey, "Content-Type": "application/json" },
    timeout: profile.timeout ?? 30000,
  });

  return _client;
}

export async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const res = await getClient().get<T>(path, { params }).catch(handleError);
  return res.data;
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
  const res = await getClient().post<T>(path, body).catch(handleError);
  return res.data;
}

export async function put<T>(path: string, body?: unknown): Promise<T> {
  const res = await getClient().put<T>(path, body).catch(handleError);
  return res.data;
}

export async function patch<T>(path: string, body?: unknown): Promise<T> {
  const res = await getClient().patch<T>(path, body).catch(handleError);
  return res.data;
}

export async function del<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const res = await getClient().delete<T>(path, { params }).catch(handleError);
  return res.data;
}

function handleError(err: unknown): never {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    const data   = err.response?.data;
    const msg    = (data && typeof data === "object" && "message" in data)
      ? String((data as Record<string, unknown>).message)
      : err.message;
    writeError({ error: "api_error", status, message: msg });
    process.exit(1); // exit 1 = API / runtime error
  }
  throw err;
}

// Always write errors as JSON to stderr so AI can parse them
export function writeError(obj: Record<string, unknown>): void {
  process.stderr.write(JSON.stringify(obj) + "\n");
}

// Apply --fields filter: "id,name,active" → picks only those keys from each item
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
