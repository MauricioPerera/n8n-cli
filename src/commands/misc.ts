import { Command } from "commander";
import { get, getAll, post, put, del, out, readStdin } from "../api.js";

// ─── TAGS ─────────────────────────────────────────────────────────────────────

export function tagsCmd(): Command {
  const cmd = new Command("tags").description("Manage tags");

  cmd.command("list")
    .description("List all tags")
    .option("--with-usage-count", "Include workflow usage count per tag")
    .option("--limit <n>", "Max results", "10")
    .option("--cursor <cursor>", "Pagination cursor")
    .option("--all", "Fetch ALL pages automatically")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (opts) => {
      const params: Record<string, unknown> = {};
      if (opts.withUsageCount) params.withUsageCount = true;
      if (opts.all) {
        out(await getAll("/tags", params), opts.fields);
      } else {
        params.limit = Number(opts.limit);
        if (opts.cursor) params.cursor = opts.cursor;
        out(await get("/tags", params), opts.fields);
      }
    });

  cmd.command("get <id>")
    .description("Get a tag by ID")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (id, opts) => {
      out(await get(`/tags/${id}`), opts.fields);
    });

  cmd.command("create")
    .description("Create a new tag")
    .requiredOption("--name <n>", "Tag name (must be unique)")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (opts) => {
      out(await post("/tags", { name: opts.name }), opts.fields);
    });

  cmd.command("update <id>")
    .description("Rename a tag")
    .requiredOption("--name <n>", "New tag name")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (id, opts) => {
      out(await put(`/tags/${id}`, { name: opts.name }), opts.fields);
    });

  cmd.command("delete <id>")
    .description("Delete a tag (removes it from all associated workflows)")
    .action(async (id) => {
      out(await del(`/tags/${id}`));
    });

  return cmd;
}

// ─── VARIABLES ────────────────────────────────────────────────────────────────

export function variablesCmd(): Command {
  const cmd = new Command("variables").description("Manage instance variables (access in workflows via $vars.key)");

  cmd.command("list")
    .description("List all instance variables")
    .option("--limit <n>", "Max results", "10")
    .option("--cursor <cursor>", "Pagination cursor")
    .option("--all", "Fetch ALL pages automatically")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (opts) => {
      const params: Record<string, unknown> = {};
      if (opts.all) {
        out(await getAll("/variables", params), opts.fields);
      } else {
        params.limit = Number(opts.limit);
        if (opts.cursor) params.cursor = opts.cursor;
        out(await get("/variables", params), opts.fields);
      }
    });

  cmd.command("create")
    .description("Create an instance variable (accessible in all workflows via $vars.KEY)")
    .requiredOption("--key <k>", "Variable key/name")
    .requiredOption("--value <v>", "Variable value")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (opts) => {
      out(await post("/variables", { key: opts.key, value: opts.value }), opts.fields);
    });

  cmd.command("delete <id>")
    .description("Delete a variable (workflows using $vars.KEY will fail after deletion)")
    .action(async (id) => {
      out(await del(`/variables/${id}`));
    });

  return cmd;
}

// ─── USERS ────────────────────────────────────────────────────────────────────

export function usersCmd(): Command {
  const cmd = new Command("users").description("Manage users (requires Admin or Owner role)");

  cmd.command("list")
    .description("List all users in the instance")
    .option("--include-role", "Include role details")
    .option("--project-id <id>", "Filter by project ID")
    .option("--limit <n>", "Max results", "10")
    .option("--cursor <cursor>", "Pagination cursor")
    .option("--all", "Fetch ALL pages automatically")
    .option("--fields <fields>", "Comma-separated fields to return, e.g. id,email,role")
    .action(async (opts) => {
      const params: Record<string, unknown> = {};
      if (opts.includeRole) params.includeRole = true;
      if (opts.projectId)   params.projectId = opts.projectId;
      if (opts.all) {
        out(await getAll("/users", params), opts.fields);
      } else {
        params.limit = Number(opts.limit);
        if (opts.cursor) params.cursor = opts.cursor;
        out(await get("/users", params), opts.fields);
      }
    });

  cmd.command("get <idOrEmail>")
    .description("Get a user by ID or email address")
    .option("--include-role", "Include role details")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (idOrEmail, opts) => {
      const params: Record<string, unknown> = {};
      if (opts.includeRole) params.includeRole = true;
      out(await get(`/users/${encodeURIComponent(idOrEmail)}`, params), opts.fields);
    });

  cmd.command("create")
    .description("Invite users. Body: JSON array of {email, role} objects")
    .option("--data <json>", "JSON array: [{\"email\":\"x@y.com\",\"role\":\"member\"}]")
    .action(async (opts) => {
      let body: unknown;
      if (opts.data) body = JSON.parse(opts.data);
      else {
        const raw = await readStdin();
        body = JSON.parse(raw);
      }
      out(await post("/users", body));
    });

  cmd.command("update <id>")
    .description("Update a user's role")
    .requiredOption("--role <role>", "New role: owner | admin | member")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (id, opts) => {
      out(await put(`/users/${id}/role`, { newRoleName: opts.role }), opts.fields);
    });

  cmd.command("delete <id>")
    .description("Delete a user from the instance")
    .option("--transfer-to <userId>", "Transfer workflows/credentials to this user ID before deleting")
    .action(async (id, opts) => {
      const params: Record<string, unknown> = {};
      if (opts.transferTo) params.transferToUserId = opts.transferTo;
      out(await del(`/users/${id}`, params));
    });

  return cmd;
}

// ─── PROJECTS ─────────────────────────────────────────────────────────────────

export function projectsCmd(): Command {
  const cmd = new Command("projects").description("Manage projects (Enterprise)");

  cmd.command("list")
    .description("List all projects")
    .option("--limit <n>", "Max results", "10")
    .option("--cursor <cursor>", "Pagination cursor")
    .option("--all", "Fetch ALL pages automatically")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (opts) => {
      const params: Record<string, unknown> = {};
      if (opts.all) {
        out(await getAll("/projects", params), opts.fields);
      } else {
        params.limit = Number(opts.limit);
        if (opts.cursor) params.cursor = opts.cursor;
        out(await get("/projects", params), opts.fields);
      }
    });

  cmd.command("create")
    .description("Create a project")
    .requiredOption("--name <n>", "Project name")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (opts) => {
      out(await post("/projects", { name: opts.name }), opts.fields);
    });

  cmd.command("update <id>")
    .description("Update a project")
    .option("--name <n>", "New project name")
    .option("--fields <fields>", "Comma-separated fields to return")
    .action(async (id, opts) => {
      const body: Record<string, unknown> = {};
      if (opts.name) body.name = opts.name;
      out(await put(`/projects/${id}`, body), opts.fields);
    });

  cmd.command("delete <id>")
    .description("Delete a project")
    .action(async (id) => {
      out(await del(`/projects/${id}`));
    });

  return cmd;
}

// ─── AUDIT ────────────────────────────────────────────────────────────────────

export function auditCmd(): Command {
  const cmd = new Command("audit").description("Security audit of the n8n instance");

  cmd.command("run")
    .description("Run a security audit. Categories: credentials, database, filesystem, instance, nodes, workflows")
    .option("--categories <cats>", "Comma-separated subset of categories to audit")
    .option("--days-abandoned <n>", "Days without execution to flag as abandoned", "90")
    .action(async (opts) => {
      const additionalOptions: Record<string, unknown> = {
        daysAbandonedWorkflow: Number(opts.daysAbandoned),
      };
      if (opts.categories) {
        additionalOptions.categories = opts.categories.split(",").map((s: string) => s.trim());
      }
      out(await post("/audit", { additionalOptions }));
    });

  return cmd;
}

// ─── SOURCE CONTROL ───────────────────────────────────────────────────────────

export function sourceControlCmd(): Command {
  const cmd = new Command("source-control").description("Git source control integration (Enterprise)");

  cmd.command("pull")
    .description("Pull changes from the connected Git repository into n8n")
    .option("--force", "Force pull even if there are local conflicts")
    .action(async (opts) => {
      out(await post("/source-control/pull", { force: !!opts.force }));
    });

  cmd.command("status")
    .description("Get current source control preferences and connection status")
    .action(async () => {
      out(await get("/source-control/preferences"));
    });

  return cmd;
}

// ─── LDAP ─────────────────────────────────────────────────────────────────────

export function ldapCmd(): Command {
  const cmd = new Command("ldap").description("LDAP configuration (Enterprise)");

  cmd.command("config")
    .description("Get current LDAP configuration")
    .action(async () => {
      out(await get("/ldap/config"));
    });

  cmd.command("sync")
    .description("Run LDAP sync to import/update users from LDAP directory")
    .option("--dry-run", "Preview changes without applying them")
    .action(async (opts) => {
      out(await post("/ldap/sync", { type: opts.dryRun ? "dry" : "live" }));
    });

  cmd.command("sync-list")
    .description("List LDAP sync history")
    .option("--limit <n>", "Max results", "10")
    .option("--cursor <cursor>", "Pagination cursor")
    .option("--all", "Fetch ALL pages automatically")
    .action(async (opts) => {
      const params: Record<string, unknown> = {};
      if (opts.all) {
        out(await getAll("/ldap/sync", params));
      } else {
        params.limit = Number(opts.limit);
        if (opts.cursor) params.cursor = opts.cursor;
        out(await get("/ldap/sync", params));
      }
    });

  return cmd;
}

