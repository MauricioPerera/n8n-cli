/**
 * n8n-cli library exports — importable without Commander dependency.
 *
 * Usage from n8n-a2e or other consumers:
 *   import { loadConfig, resolveProfile, loadCatalog, syncCatalog, searchNodes } from "n8n-cli/lib";
 */

// ─── Config & Profiles ──────────────────────────────────────────────────────
export {
  type Profile,
  type ConfigFile,
  loadConfig,
  loadGlobalConfig,
  saveGlobalConfig,
  resolveProfile,
  resolveProfileName,
  setSelectedProfile,
  maskApiKey,
  getGlobalConfigPath,
  getLocalConfigPath,
} from "./config.js";

// ─── Catalog & Node Search ──────────────────────────────────────────────────
export {
  type NodeParam,
  type CatalogNode,
  type CatalogFile,
  type SearchResult,
  loadCatalog,
  syncCatalog,
  searchNodes,
} from "./catalog.js";

// ─── HTTP Client (raw fetch, no process.exit) ───────────────────────────────
export { rawFetch, type RawFetchOpts } from "./api.js";
