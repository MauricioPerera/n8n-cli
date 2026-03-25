import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface Profile {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

export interface ConfigFile {
  default?: string;
  profiles: Record<string, Profile>;
}

const GLOBAL_DIR = path.join(os.homedir(), ".n8n-cli");
const GLOBAL_CONFIG = path.join(GLOBAL_DIR, "config.json");
const LOCAL_CONFIG = ".n8nrc";

let _selectedProfile: string | undefined;

/** Set the profile name chosen via --profile flag */
export function setSelectedProfile(name: string): void {
  _selectedProfile = name;
}

/** Read and parse a config file, returns null if missing or invalid */
function readConfigFile(filePath: string): ConfigFile | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.profiles) return parsed as ConfigFile;
    return null;
  } catch {
    return null;
  }
}

/** Load config with priority: local .n8nrc > global ~/.n8n-cli/config.json */
export function loadConfig(): ConfigFile {
  const global = readConfigFile(GLOBAL_CONFIG);
  const local = readConfigFile(path.resolve(process.cwd(), LOCAL_CONFIG));

  if (!global && !local) return { profiles: {} };
  if (!global) return local!;
  if (!local) return global;

  // Merge: local profiles override global profiles, local default overrides global default
  return {
    default: local.default ?? global.default,
    profiles: { ...global.profiles, ...local.profiles },
  };
}

/**
 * Resolve the active profile considering priority:
 * 1. Env vars (N8N_BASE_URL + N8N_API_KEY) — highest
 * 2. Config file profile (selected via --profile or "default" key)
 */
export function resolveProfile(): Profile | null {
  const envBase = process.env.N8N_BASE_URL;
  const envKey = process.env.N8N_API_KEY;

  // Env vars take priority when both are set
  if (envBase && envKey) {
    return {
      baseUrl: envBase,
      apiKey: envKey,
      timeout: process.env.N8N_TIMEOUT ? Number(process.env.N8N_TIMEOUT) : undefined,
    };
  }

  const config = loadConfig();
  const profileName = _selectedProfile ?? config.default;

  if (!profileName || !config.profiles[profileName]) return null;
  return config.profiles[profileName];
}

/** Get the resolved profile name (for display purposes) */
export function resolveProfileName(): string | null {
  if (process.env.N8N_BASE_URL && process.env.N8N_API_KEY) return "(env)";
  const config = loadConfig();
  return _selectedProfile ?? config.default ?? null;
}

/** Save config to the global config file */
export function saveGlobalConfig(config: ConfigFile): void {
  if (!fs.existsSync(GLOBAL_DIR)) {
    fs.mkdirSync(GLOBAL_DIR, { recursive: true });
  }
  fs.writeFileSync(GLOBAL_CONFIG, JSON.stringify(config, null, 2) + "\n", "utf8");
}

/** Load only the global config file */
export function loadGlobalConfig(): ConfigFile {
  return readConfigFile(GLOBAL_CONFIG) ?? { profiles: {} };
}

/** Get paths for display */
export function getGlobalConfigPath(): string {
  return GLOBAL_CONFIG;
}

export function getLocalConfigPath(): string {
  return path.resolve(process.cwd(), LOCAL_CONFIG);
}

/** Mask an API key for safe display: show first 8 and last 4 chars */
export function maskApiKey(key: string): string {
  if (key.length <= 16) return key.slice(0, 4) + "..." + key.slice(-4);
  return key.slice(0, 8) + "..." + key.slice(-4);
}
