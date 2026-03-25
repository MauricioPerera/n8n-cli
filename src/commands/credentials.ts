import { Command } from "commander";
import { get, getAll, post, put, del, out, readStdin } from "../api.js";

export function credentialsCmd(): Command {
  const cmd = new Command("credentials").description("Manage credentials");

  cmd.command("list")
    .description("List all credentials")
    .option("--include-data", "Include decrypted credential data (use with caution)")
    .option("--limit <n>", "Max results per page", "10")
    .option("--cursor <cursor>", "Pagination cursor")
    .option("--all", "Fetch ALL pages automatically")
    .option("--fields <fields>", "Comma-separated fields to return, e.g. id,name,type")
    .action(async (opts) => {
      const params: Record<string, unknown> = {};
      if (opts.includeData) params.includeData = true;
      if (opts.all) {
        out(await getAll("/credentials", params), opts.fields);
      } else {
        params.limit = Number(opts.limit);
        if (opts.cursor) params.cursor = opts.cursor;
        out(await get("/credentials", params), opts.fields);
      }
    });

  cmd.command("get <id>")
    .description("Get a credential by ID")
    .option("--include-data", "Include decrypted credential data")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (id, opts) => {
      const params: Record<string, unknown> = {};
      if (opts.includeData) params.includeData = true;
      out(await get(`/credentials/${id}`, params), opts.fields);
    });

  cmd.command("schema <type>")
    .description("Get required fields schema for a credential type (e.g. slackApi, openAiApi, googleDriveOAuth2Api)")
    .action(async (type) => {
      out(await get(`/credentials/schema/${type}`));
    });

  cmd.command("create")
    .description("Create a credential. Use 'schema <type>' first to discover required fields.")
    .requiredOption("--name <n>", "Credential display name")
    .requiredOption("--type <type>", "Credential type (e.g. slackApi, openAiApi)")
    .option("--data <json>", "Credential data as JSON string")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (opts) => {
      let data: Record<string, unknown> = {};
      if (opts.data) data = JSON.parse(opts.data);
      else {
        const raw = await readStdin();
        if (raw) data = JSON.parse(raw);
      }
      out(await post("/credentials", { name: opts.name, type: opts.type, data }), opts.fields);
    });

  cmd.command("update <id>")
    .description("Update a credential's name or data")
    .option("--name <n>", "New display name")
    .option("--data <json>", "Updated credential data as JSON string")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (id, opts) => {
      const body: Record<string, unknown> = {};
      if (opts.name) body.name = opts.name;
      if (opts.data) body.data = JSON.parse(opts.data);
      else {
        const raw = await readStdin();
        if (raw) body.data = JSON.parse(raw);
      }
      out(await put(`/credentials/${id}`, body), opts.fields);
    });

  cmd.command("delete <id>")
    .description("Permanently delete a credential")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (id, opts) => {
      out(await del(`/credentials/${id}`), opts.fields);
    });

  cmd.command("transfer <id>")
    .description("Transfer a credential to another project")
    .requiredOption("--project-id <id>", "Destination project ID")
    .action(async (id, opts) => {
      out(await put(`/credentials/${id}/transfer`, { destinationProjectId: opts.projectId }));
    });

  return cmd;
}

