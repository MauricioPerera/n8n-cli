import { Command } from "commander";
import { out, writeError } from "../api.js";
import { loadCatalog, syncCatalog, searchNodes } from "../catalog.js";
import { resolveProfileName } from "../config.js";

export function nodesCmd(): Command {
  const cmd = new Command("nodes").description(
    "Node catalog — discover and inspect available n8n node types.\n" +
    "Run 'nodes sync' first to extract node definitions from your n8n instance."
  );

  cmd.command("sync")
    .description("Extract node definitions from the connected n8n instance and cache locally per profile")
    .action(async () => {
      const catalog = await syncCatalog();
      out({
        ok: true,
        profileName: catalog.profileName,
        baseUrl: catalog.baseUrl,
        nodeCount: catalog.nodeCount,
        syncedAt: catalog.syncedAt,
        categories: getCategoryCounts(catalog.nodes.map((n) => n.category)),
      });
    });

  cmd.command("list")
    .description("List cached node types, optionally filtered by category")
    .option("--category <cat>", "Filter by category: trigger|action|ai|transform|flow|output|utility")
    .option("--limit <n>", "Max results", "50")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action((opts) => {
      const catalog = requireCatalog();
      let nodes = catalog.nodes;
      if (opts.category) {
        nodes = nodes.filter((n) => n.category === opts.category);
      }
      nodes = nodes.slice(0, Number(opts.limit));

      // By default, return a compact summary for list
      const compact = nodes.map((n) => ({
        n8nType: n.n8nType,
        displayName: n.displayName,
        category: n.category,
        description: n.description,
        credentials: n.credentials,
      }));
      out({ total: nodes.length, catalogTotal: catalog.nodeCount, data: compact }, opts.fields);
    });

  cmd.command("get <n8nType>")
    .description("Get full definition of a node type including all parameters, credentials, inputs/outputs")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action((n8nType, opts) => {
      const catalog = requireCatalog();
      const node = catalog.nodes.find((n) => n.n8nType === n8nType);
      if (!node) {
        // Try fuzzy match
        const matches = catalog.nodes.filter((n) =>
          n.n8nType.toLowerCase().includes(n8nType.toLowerCase()) ||
          n.displayName.toLowerCase().includes(n8nType.toLowerCase())
        );
        if (matches.length > 0) {
          writeError({
            error: "not_found",
            message: `Node '${n8nType}' not found. Did you mean one of these?`,
            suggestions: matches.slice(0, 5).map((m) => m.n8nType),
          });
        } else {
          writeError({
            error: "not_found",
            message: `Node '${n8nType}' not found in catalog.`,
            hint: "Run 'nodes sync' to refresh, or 'nodes search <query>' to discover nodes.",
          });
        }
        process.exit(1);
      }
      out(node, opts.fields);
    });

  cmd.command("search <query>")
    .description("Search nodes by natural language query (e.g. 'send email', 'slack message', 'AI agent')")
    .option("--limit <n>", "Max results", "10")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action((query, opts) => {
      const catalog = requireCatalog();
      const results = searchNodes(catalog.nodes, query, Number(opts.limit));
      const data = results.map((r) => ({
        n8nType: r.node.n8nType,
        displayName: r.node.displayName,
        category: r.node.category,
        description: r.node.description,
        credentials: r.node.credentials,
        score: r.score,
      }));
      out({ query, results: data.length, data }, opts.fields);
    });

  cmd.command("categories")
    .description("List available node categories with counts")
    .action(() => {
      const catalog = requireCatalog();
      const counts = getCategoryCounts(catalog.nodes.map((n) => n.category));
      out({
        catalogTotal: catalog.nodeCount,
        syncedAt: catalog.syncedAt,
        categories: counts,
      });
    });

  return cmd;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function requireCatalog() {
  const catalog = loadCatalog();
  if (!catalog) {
    const profile = resolveProfileName() ?? "default";
    writeError({
      error: "no_catalog",
      message: `No node catalog found for profile '${profile}'.`,
      hint: `Run 'n8n-cli nodes sync' (or 'n8n-cli --profile ${profile} nodes sync') to build the catalog.`,
    });
    process.exit(2);
  }
  return catalog;
}

function getCategoryCounts(categories: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of categories) {
    counts[c] = (counts[c] || 0) + 1;
  }
  return counts;
}
