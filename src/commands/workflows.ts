import { Command } from "commander";
import { get, getAll, post, put, del, out, readStdin } from "../api.js";

export function workflowsCmd(): Command {
  const cmd = new Command("workflows").description("Manage workflows");

  cmd.command("list")
    .description("List all workflows")
    .option("--active", "Filter active workflows only")
    .option("--inactive", "Filter inactive workflows only")
    .option("--tags <tags>", "Comma-separated tag names to filter by")
    .option("--name <n>", "Filter by name (partial match)")
    .option("--project-id <id>", "Filter by project ID")
    .option("--limit <n>", "Max results per page", "10")
    .option("--cursor <cursor>", "Pagination cursor")
    .option("--all", "Fetch ALL pages automatically (ignores --limit and --cursor)")
    .option("--fields <fields>", "Comma-separated fields to return, e.g. id,name,active")
    .action(async (opts) => {
      const params: Record<string, unknown> = {};
      if (opts.active)    params.active = true;
      if (opts.inactive)  params.active = false;
      if (opts.tags)      params.tags = opts.tags;
      if (opts.name)      params.name = opts.name;
      if (opts.projectId) params.projectId = opts.projectId;
      if (opts.all) {
        out(await getAll("/workflows", params), opts.fields);
      } else {
        params.limit = Number(opts.limit);
        if (opts.cursor) params.cursor = opts.cursor;
        out(await get("/workflows", params), opts.fields);
      }
    });

  cmd.command("get <id>")
    .description("Get a workflow by ID (includes full nodes and connections)")
    .option("--exclude-pinned-data", "Exclude pinned data from response")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (id, opts) => {
      const params: Record<string, unknown> = {};
      if (opts.excludePinnedData) params.excludePinnedData = true;
      out(await get(`/workflows/${id}`, params), opts.fields);
    });

  cmd.command("create")
    .description("Create a new workflow (reads JSON from stdin or --data)")
    .option("--name <n>", "Workflow name")
    .option("--data <json>", "Full workflow JSON inline")
    .option("--active", "Activate immediately after creation")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (opts) => {
      let body: Record<string, unknown>;
      if (opts.data) {
        body = JSON.parse(opts.data);
      } else {
        const raw = await readStdin();
        body = raw ? JSON.parse(raw) : { name: opts.name || "New Workflow", nodes: [], connections: {}, settings: {} };
      }
      if (opts.name)   body.name = opts.name;
      if (opts.active) body.active = true;
      out(await post("/workflows", body), opts.fields);
    });

  cmd.command("update <id>")
    .description("Update a workflow (reads JSON from stdin or --data)")
    .option("--name <n>", "New name")
    .option("--data <json>", "Partial or full workflow JSON")
    .option("--active", "Activate")
    .option("--inactive", "Deactivate")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (id, opts) => {
      let partial: Record<string, unknown> = {};
      if (opts.data) partial = JSON.parse(opts.data);
      else {
        const raw = await readStdin();
        if (raw) partial = JSON.parse(raw);
      }
      if (opts.name) partial.name = opts.name;
      // n8n PUT requires full workflow — fetch current, keep only writable fields, merge
      const current = await get<Record<string, unknown>>(`/workflows/${id}`);
      const allowed = ["name", "nodes", "connections", "settings"];
      const base: Record<string, unknown> = {};
      for (const k of allowed) {
        if (k in current) base[k] = current[k];
      }
      // Strip read-only fields from partial too
      delete partial.active;
      const body = { ...base, ...partial };
      const result = await put(`/workflows/${id}`, body);
      // Handle --active / --inactive via dedicated endpoints
      if (opts.active)        await post(`/workflows/${id}/activate`);
      else if (opts.inactive) await post(`/workflows/${id}/deactivate`);
      out(opts.active || opts.inactive ? await get(`/workflows/${id}`) : result, opts.fields);
    });

  cmd.command("delete <id>")
    .description("Permanently delete a workflow and all its execution history")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (id, opts) => {
      out(await del(`/workflows/${id}`), opts.fields);
    });

  cmd.command("activate <id>")
    .description("Activate (publish) a workflow — enables its triggers")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (id, opts) => {
      out(await post(`/workflows/${id}/activate`), opts.fields);
    });

  cmd.command("deactivate <id>")
    .description("Deactivate a workflow — stops all triggers from firing")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (id, opts) => {
      out(await post(`/workflows/${id}/deactivate`), opts.fields);
    });

  cmd.command("tags <id>")
    .description("Get all tags associated with a workflow")
    .action(async (id) => {
      out(await get(`/workflows/${id}/tags`));
    });

  cmd.command("set-tags <id>")
    .description("Replace all tags on a workflow (provide complete desired list)")
    .requiredOption("--tag-ids <ids>", "Comma-separated tag IDs")
    .action(async (id, opts) => {
      const tagIds = opts.tagIds.split(",").map((t: string) => ({ id: t.trim() }));
      out(await put(`/workflows/${id}/tags`, tagIds));
    });

  cmd.command("transfer <id>")
    .description("Transfer a workflow to a different project")
    .requiredOption("--project-id <id>", "Destination project ID")
    .action(async (id, opts) => {
      out(await put(`/workflows/${id}/transfer`, { destinationProjectId: opts.projectId }));
    });

  cmd.command("history <id>")
    .description("List version history of a workflow (Enterprise feature)")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (id, opts) => {
      out(await get(`/workflows/${id}/history`), opts.fields);
    });

  cmd.command("history-get <id> <versionId>")
    .description("Get a specific historical version of a workflow")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (id, versionId, opts) => {
      out(await get(`/workflows/${id}/history/${versionId}`), opts.fields);
    });

  return cmd;
}

