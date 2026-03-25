import { Command } from "commander";
import {
  loadGlobalConfig,
  saveGlobalConfig,
  loadConfig,
  getGlobalConfigPath,
  getLocalConfigPath,
  maskApiKey,
  resolveProfileName,
} from "../config.js";
import { out, writeError } from "../api.js";
import * as fs from "fs";

export function profileCmd(): Command {
  const cmd = new Command("profile").description("Manage connection profiles for multiple n8n instances");

  cmd.command("list")
    .description("List all configured profiles")
    .action(() => {
      const config = loadConfig();
      const currentName = resolveProfileName();
      const profiles = Object.entries(config.profiles).map(([name, p]) => ({
        name,
        baseUrl: p.baseUrl,
        apiKey: maskApiKey(p.apiKey),
        timeout: p.timeout ?? 30000,
        active: name === currentName,
        default: name === config.default,
      }));
      out(profiles);
    });

  cmd.command("add <name>")
    .description("Add a new profile to the global config (~/.n8n-cli/config.json)")
    .requiredOption("--base-url <url>", "n8n instance base URL")
    .requiredOption("--api-key <key>", "API key for the instance")
    .option("--timeout <ms>", "Request timeout in milliseconds")
    .option("--set-default", "Set this profile as the default")
    .action((name, opts) => {
      const config = loadGlobalConfig();
      if (config.profiles[name]) {
        writeError({ error: "profile_exists", message: `Profile '${name}' already exists. Use 'profile update' or 'profile remove' first.` });
        process.exit(2);
      }
      config.profiles[name] = {
        baseUrl: opts.baseUrl,
        apiKey: opts.apiKey,
        ...(opts.timeout ? { timeout: Number(opts.timeout) } : {}),
      };
      if (opts.setDefault || !config.default) {
        config.default = name;
      }
      saveGlobalConfig(config);
      out({ ok: true, profile: name, configPath: getGlobalConfigPath(), default: config.default === name });
    });

  cmd.command("update <name>")
    .description("Update an existing profile")
    .option("--base-url <url>", "New base URL")
    .option("--api-key <key>", "New API key")
    .option("--timeout <ms>", "New timeout in milliseconds")
    .action((name, opts) => {
      const config = loadGlobalConfig();
      if (!config.profiles[name]) {
        writeError({ error: "not_found", message: `Profile '${name}' does not exist.`, available: Object.keys(config.profiles) });
        process.exit(2);
      }
      if (opts.baseUrl) config.profiles[name].baseUrl = opts.baseUrl;
      if (opts.apiKey) config.profiles[name].apiKey = opts.apiKey;
      if (opts.timeout) config.profiles[name].timeout = Number(opts.timeout);
      saveGlobalConfig(config);
      out({ ok: true, profile: name, updated: Object.keys(opts).filter((k) => opts[k]) });
    });

  cmd.command("remove <name>")
    .description("Remove a profile from the global config")
    .action((name) => {
      const config = loadGlobalConfig();
      if (!config.profiles[name]) {
        writeError({ error: "not_found", message: `Profile '${name}' does not exist.` });
        process.exit(2);
      }
      delete config.profiles[name];
      if (config.default === name) {
        const remaining = Object.keys(config.profiles);
        config.default = remaining.length > 0 ? remaining[0] : undefined;
      }
      saveGlobalConfig(config);
      out({ ok: true, removed: name, newDefault: config.default ?? null });
    });

  cmd.command("use <name>")
    .description("Set a profile as the default")
    .action((name) => {
      const config = loadGlobalConfig();
      if (!config.profiles[name]) {
        writeError({ error: "not_found", message: `Profile '${name}' does not exist.`, available: Object.keys(config.profiles) });
        process.exit(2);
      }
      config.default = name;
      saveGlobalConfig(config);
      out({ ok: true, default: name });
    });

  cmd.command("show [name]")
    .description("Show details of a profile (current profile if no name given)")
    .action((name) => {
      const config = loadConfig();
      const profileName = name ?? resolveProfileName();
      if (!profileName || profileName === "(env)") {
        if (process.env.N8N_BASE_URL) {
          out({
            source: "environment variables",
            baseUrl: process.env.N8N_BASE_URL,
            apiKey: process.env.N8N_API_KEY ? maskApiKey(process.env.N8N_API_KEY) : "(not set)",
            timeout: process.env.N8N_TIMEOUT ?? 30000,
          });
          return;
        }
        writeError({ error: "no_profile", message: "No profile configured. Use 'profile add <name>' to create one." });
        process.exit(2);
      }
      const profile = config.profiles[profileName];
      if (!profile) {
        writeError({ error: "not_found", message: `Profile '${profileName}' not found.`, available: Object.keys(config.profiles) });
        process.exit(2);
      }
      // Detect source
      const localPath = getLocalConfigPath();
      let source = getGlobalConfigPath();
      try {
        const localRaw = fs.readFileSync(localPath, "utf8");
        const local = JSON.parse(localRaw);
        if (local.profiles && local.profiles[profileName]) source = localPath;
      } catch {}
      out({
        name: profileName,
        baseUrl: profile.baseUrl,
        apiKey: maskApiKey(profile.apiKey),
        timeout: profile.timeout ?? 30000,
        default: config.default === profileName,
        source,
      });
    });

  return cmd;
}
