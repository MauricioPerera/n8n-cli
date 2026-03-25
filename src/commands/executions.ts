import { Command } from "commander";
import { get, getAll, post, del, out } from "../api.js";

export function executionsCmd(): Command {
  const cmd = new Command("executions").description("Manage workflow executions");

  cmd.command("list")
    .description("List executions with optional filters")
    .option("--workflow-id <id>", "Filter by workflow ID")
    .option("--status <status>", "Filter by status: success|error|canceled|running|waiting|new")
    .option("--include-data", "Include full node input/output data in response")
    .option("--limit <n>", "Max results per page", "10")
    .option("--cursor <cursor>", "Pagination cursor")
    .option("--all", "Fetch ALL pages automatically (ignores --limit and --cursor)")
    .option("--fields <fields>", "Comma-separated fields to return, e.g. id,status,startedAt")
    .action(async (opts) => {
      const params: Record<string, unknown> = {};
      if (opts.workflowId)  params.workflowId = opts.workflowId;
      if (opts.status)      params.status = opts.status;
      if (opts.includeData) params.includeData = true;
      if (opts.all) {
        out(await getAll("/executions", params), opts.fields);
      } else {
        params.limit = Number(opts.limit);
        if (opts.cursor) params.cursor = opts.cursor;
        out(await get("/executions", params), opts.fields);
      }
    });

  cmd.command("get <id>")
    .description("Get full details of a single execution")
    .option("--include-data", "Include full node input/output data")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (id, opts) => {
      const params: Record<string, unknown> = {};
      if (opts.includeData) params.includeData = true;
      out(await get(`/executions/${id}`, params), opts.fields);
    });

  cmd.command("delete <id>")
    .description("Delete a single execution and all its associated data")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (id, opts) => {
      out(await del(`/executions/${id}`), opts.fields);
    });

  cmd.command("retry <id>")
    .description("Retry a failed or stopped execution")
    .option("--load-workflow", "Use latest workflow version (default: use original snapshot)")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (id, opts) => {
      out(await post(`/executions/${id}/retry`, { loadWorkflow: !!opts.loadWorkflow }), opts.fields);
    });

  return cmd;
}
