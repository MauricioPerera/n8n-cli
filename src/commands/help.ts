import { Command } from "commander";
import { out } from "../api.js";

// ─── HELP COMMAND ─────────────────────────────────────────────────────────────
// Human-readable structured help organized by use case

export function helpCmd(): Command {
  const cmd = new Command("help-ai")
    .description("Full AI-optimized command reference with examples");

  cmd
    .command("all")
    .description("Print complete command reference as JSON")
    .action(() => {
      out(FULL_SCHEMA);
    });

  cmd
    .command("group <group>")
    .description("Print reference for a single command group")
    .action((group) => {
      const g = FULL_SCHEMA.groups.find((x) => x.name === group);
      if (!g) {
        process.stderr.write(
          JSON.stringify({ error: "not_found", message: `Unknown group: ${group}`, available: FULL_SCHEMA.groups.map((x) => x.name) }) + "\n"
        );
        process.exit(2);
      }
      out(g);
    });

  cmd
    .command("list-groups")
    .description("List available command groups")
    .action(() => {
      out(FULL_SCHEMA.groups.map((g) => ({ name: g.name, description: g.description })));
    });

  return cmd;
}

// ─── META COMMAND ─────────────────────────────────────────────────────────────
// Machine-readable schema of the entire CLI — for AI to load once and reference

export function metaCmd(): Command {
  const cmd = new Command("meta")
    .description("Machine-readable CLI schema for AI consumption");

  cmd
    .command("schema")
    .description("Output full CLI schema as JSON (commands, options, examples, exit codes)")
    .action(() => {
      out(FULL_SCHEMA);
    });

  cmd
    .command("exit-codes")
    .description("Explain exit codes returned by the CLI")
    .action(() => {
      out(FULL_SCHEMA.exit_codes);
    });

  cmd
    .command("common-options")
    .description("Options available on most commands")
    .action(() => {
      out(FULL_SCHEMA.common_options);
    });

  cmd
    .command("patterns")
    .description("Common usage patterns and recipes for AI agents")
    .action(() => {
      out(FULL_SCHEMA.patterns);
    });

  cmd
    .command("workflow-template")
    .description("Print a complete workflow JSON template with all fields documented")
    .action(() => {
      out(WORKFLOW_TEMPLATE);
    });

  cmd
    .command("credential-guide")
    .description("Explain how credentials map into workflow node parameters")
    .action(() => {
      out(CREDENTIAL_GUIDE);
    });

  cmd
    .command("ai-recipes")
    .description("Multi-step operation recipes for AI agents building n8n workflows")
    .action(() => {
      out(AI_RECIPES);
    });

  return cmd;
}

// ─── WORKFLOW TEMPLATE ───────────────────────────────────────────────────────

const WORKFLOW_TEMPLATE = {
  description: "Template showing the exact JSON structure n8n expects when creating a workflow.",
  template: {
    name: "My Workflow",
    nodes: [
      {
        name: "Trigger Node (unique display name)",
        type: "n8n-nodes-base.webhook (n8nType from 'nodes get')",
        typeVersion: 2,
        position: [0, 0],
        parameters: {
          httpMethod: "POST",
          path: "my-hook",
          _note: "Parameter keys must match properties[].name from 'nodes get <type>'",
        },
      },
      {
        name: "Action Node",
        type: "n8n-nodes-base.slack",
        typeVersion: 2,
        position: [250, 0],
        parameters: {
          resource: "message",
          operation: "post",
          text: "={{ $json.body.message }}",
        },
        credentials: {
          slackApi: {
            id: "<id-from-credentials-list>",
            name: "Display name",
          },
        },
      },
    ],
    connections: {
      "Trigger Node (unique display name)": {
        main: [
          [
            {
              node: "Action Node",
              type: "main",
              index: 0,
            },
          ],
        ],
      },
    },
    settings: {
      executionOrder: "v1",
    },
  },
  rules: {
    node_name: "Must be unique within the workflow. Used as key in connections object.",
    node_type: "Exact n8nType string from 'nodes get'. Case-sensitive.",
    typeVersion: "Use latest version from 'nodes get' → version[] array.",
    position: "[x, y] pixel coordinates. Space nodes ~250px apart horizontally.",
    parameters: "Keys must match properties[].name from 'nodes get <type>'.",
    credentials: "Object keyed by credential type (from nodes get → credentials[]), value is {id, name}. Get ID from 'credentials list'.",
    connection_types: {
      main: "Standard data flow. Used by most nodes.",
      ai_languageModel: "LLM provider → AI agent.",
      ai_memory: "Memory provider → AI agent.",
      ai_tool: "Tool → AI agent.",
      ai_vectorStore: "Vector store → memory or retrieval node.",
      ai_outputParser: "Output parser → AI chain.",
    },
  },
  expressions: {
    current_item: "={{ $json.fieldName }}",
    other_node: "={{ $('Node Name').item.json.field }}",
    first_input: "={{ $input.first().json.field }}",
    timestamp: "={{ $now.toISO() }}",
    instance_var: "={{ $vars.MY_VAR }}",
    env_var: "={{ $env.MY_ENV }}",
  },
};

// ─── CREDENTIAL GUIDE ────────────────────────────────────────────────────────

const CREDENTIAL_GUIDE = {
  description: "How to discover, create, and use credentials in workflow nodes.",
  steps: [
    {
      step: 1,
      action: "Find what credential type a node needs",
      command: "n8n-cli nodes get <n8nType>",
      output: "Look at the 'credentials' array. Each entry is a credential type name (e.g. 'slackApi', 'openAiApi').",
    },
    {
      step: 2,
      action: "Check if you already have a credential of that type",
      command: "n8n-cli credentials list --fields id,name,type --all",
      output: "Look for a credential where type matches the needed credential type.",
    },
    {
      step: 3,
      action: "If you need to create a new credential, discover required fields",
      command: "n8n-cli credentials schema <credentialType>",
      output: "Returns all fields with name, type, required flag.",
    },
    {
      step: 4,
      action: "Create the credential",
      command: "n8n-cli credentials create --name 'My Credential' --type <type> --data '{\"field\":\"value\"}'",
      output: "Returns the new credential with its ID.",
    },
    {
      step: 5,
      action: "Reference the credential in the workflow node",
      example: {
        node_credentials_field: {
          slackApi: { id: "<credential-id>", name: "My Credential" },
        },
      },
      note: "The key ('slackApi') is the credential type name. The id comes from step 2 or 4.",
    },
  ],
  important_notes: [
    "Credentials are NOT passed as node parameters. They go in a separate 'credentials' field on the node object.",
    "OAuth credentials (Gmail, Google Drive) require browser-based auth flow — they cannot be created via API. Use API key or token-based alternatives.",
    "credential IDs are instance-specific. When cloning workflows across instances, credentials must be re-mapped.",
  ],
};

// ─── AI RECIPES ──────────────────────────────────────────────────────────────

const AI_RECIPES = {
  description: "Multi-step operation recipes for AI agents working with n8n.",
  recipes: [
    {
      name: "Build a complete workflow from scratch",
      steps: [
        "n8n-cli nodes sync                                    # ensure catalog is fresh",
        "n8n-cli nodes search '<what you need>'                # discover relevant nodes",
        "n8n-cli nodes get <n8nType>                           # get parameter schema for each node",
        "n8n-cli credentials list --fields id,name,type --all  # find existing credentials",
        "n8n-cli meta workflow-template                        # get JSON template structure",
        "# Compose JSON using template + node parameters + credential IDs",
        "n8n-cli workflows create --data '<json>'              # deploy",
        "n8n-cli workflows activate <id>                       # enable triggers",
      ],
    },
    {
      name: "Clone workflow between instances",
      steps: [
        "n8n-cli --profile source workflows get <id>           # export full workflow",
        "# Remove instance-specific fields: id, createdAt, updatedAt, versionId, shared",
        "# Re-map credential IDs to target instance credentials",
        "cat cleaned.json | n8n-cli --profile target workflows create",
      ],
    },
    {
      name: "Debug a failing workflow",
      steps: [
        "n8n-cli executions list --workflow-id <id> --status error --limit 5 --fields id,startedAt,stoppedAt",
        "n8n-cli executions get <exec-id> --include-data       # full node I/O data",
        "# Inspect the 'data' field — each node has 'executionData' with input/output",
        "# Fix the problematic node parameters",
        "n8n-cli workflows update <id> --data '<fixed-json>'",
      ],
    },
    {
      name: "Batch retry failed executions",
      steps: [
        "n8n-cli executions list --workflow-id <id> --status error --all --fields id",
        "# For each execution ID:",
        "n8n-cli executions retry <exec-id>",
        "# Use --load-workflow to retry with latest workflow version instead of snapshot",
      ],
    },
    {
      name: "Audit and clean up an instance",
      steps: [
        "n8n-cli audit run                                     # security audit",
        "n8n-cli workflows list --all --fields id,name,active,updatedAt",
        "# Identify inactive/abandoned workflows",
        "n8n-cli executions list --status error --all --fields id,workflowId",
        "# Identify workflows with high error rates",
      ],
    },
    {
      name: "Set up a multi-node AI agent workflow",
      steps: [
        "n8n-cli nodes search 'AI agent'                      # find agent node",
        "n8n-cli nodes search 'chat trigger'                   # find trigger",
        "n8n-cli nodes search 'openai'                         # find LLM",
        "n8n-cli nodes get @n8n/n8n-nodes-langchain.agent      # get agent params",
        "# AI workflows use specialized connection types:",
        "# - ai_languageModel: LLM → Agent",
        "# - ai_memory: Memory → Agent",
        "# - ai_tool: Tool → Agent",
        "# Build connections accordingly (see workflow-template for types)",
      ],
    },
  ],
};

// ─── SCHEMA DEFINITION ────────────────────────────────────────────────────────

const FULL_SCHEMA = {
  name: "n8n-cli",
  version: "1.0.0",
  description: "CLI for the n8n REST API. All stdout is valid JSON. All errors go to stderr as JSON.",
  invocation: "node dist/index.js <group> <command> [options]",

  environment: {
    N8N_BASE_URL: { required: true, example: "http://localhost:5678", description: "Base URL of your n8n instance" },
    N8N_API_KEY:  { required: true, example: "eyJhbGciOi...", description: "API key from n8n Settings > n8n API" },
  },

  exit_codes: {
    "0": "Success — stdout contains valid JSON result",
    "1": "API error — stderr contains JSON { error, status, message }",
    "2": "Usage error — wrong arguments or missing env vars",
  },

  common_options: [
    { flag: "--profile <name>",  description: "Use a specific connection profile instead of the default. Profiles are managed with the 'profile' command group." },
    { flag: "--fields <fields>", description: "Return only specified fields. Comma-separated. e.g. --fields id,name,active. Works on all read commands. Applied after API response, not as a server-side filter." },
    { flag: "--all",             description: "Auto-paginate and return ALL results. Works on all list commands. Ignores --limit and --cursor." },
    { flag: "--limit <n>",       description: "Max results per page (default: 10, max: 250). Ignored when --all is used." },
    { flag: "--cursor <cursor>", description: "Pagination cursor from previous response's nextCursor field." },
    { flag: "--data <json>",     description: "Inline JSON body for create/update commands. Alternative to piping via stdin." },
  ],

  patterns: [
    {
      name: "List all items of a resource",
      command: "n8n-cli workflows list --all --fields id,name,active",
      notes: "Use --all to avoid pagination. Use --fields to reduce response size.",
    },
    {
      name: "Get a specific resource by ID",
      command: "n8n-cli workflows get <id>",
      notes: "IDs are strings (e.g. '1ksC0JQdLpBIwiUa'). Get them from list commands.",
    },
    {
      name: "Create from a JSON file",
      command: "cat workflow.json | node dist/index.js workflows create",
      notes: "Pipe JSON body via stdin. Works for workflows, credentials, users.",
    },
    {
      name: "Filter executions by status",
      command: "n8n-cli executions list --workflow-id <id> --status error --all",
      notes: "Valid statuses: success, error, canceled, running, waiting, new",
    },
    {
      name: "Retry all failed executions of a workflow",
      command: "n8n-cli executions list --workflow-id <id> --status error --all --fields id",
      notes: "Get IDs, then loop: n8n-cli executions retry <id> for each",
    },
    {
      name: "Discover credential schema before creating",
      command: "n8n-cli credentials schema slackApi",
      notes: "Always call schema first to know what fields are required for a credential type",
    },
    {
      name: "Check if errors occurred (exit code)",
      command: "n8n-cli workflows get <id>; echo $LASTEXITCODE",
      notes: "Exit 0 = success, 1 = API error (check stderr JSON), 2 = usage error",
    },
    {
      name: "Get only specific fields to reduce noise",
      command: "n8n-cli workflows list --all --fields id,name,active,updatedAt",
      notes: "Useful when full workflow JSON (with nodes/connections) is too large",
    },
    {
      name: "Activate a workflow",
      command: "n8n-cli workflows activate <id>",
      notes: "Returns updated workflow with active: true",
    },
    {
      name: "Discover nodes before building a workflow",
      command: "n8n-cli nodes search 'send email' && n8n-cli nodes get n8n-nodes-base.gmail",
      notes: "Always search for nodes first, then get full definition to know exact parameter names and types. Run 'nodes sync' once per instance to build the catalog.",
    },
    {
      name: "Run security audit",
      command: "n8n-cli audit run --categories credentials,workflows",
      notes: "Available categories: credentials, database, filesystem, instance, nodes, workflows",
    },
  ],

  groups: [
    {
      name: "profile",
      description: "Manage connection profiles for multiple n8n instances",
      commands: [
        { name: "list",          synopsis: "profile list", description: "List all configured profiles with their base URLs." },
        { name: "add",           synopsis: "profile add <name> --base-url <url> --api-key <key> [--timeout ms] [--set-default]", description: "Add a new profile to ~/.n8n-cli/config.json." },
        { name: "update",        synopsis: "profile update <name> [--base-url url] [--api-key key] [--timeout ms]", description: "Update an existing profile." },
        { name: "remove",        synopsis: "profile remove <name>", description: "Remove a profile." },
        { name: "use",           synopsis: "profile use <name>", description: "Set a profile as the default." },
        { name: "show",          synopsis: "profile show [name]", description: "Show details of a profile (current if no name given). API key is masked." },
      ],
    },
    {
      name: "nodes",
      description: "Node catalog — discover and inspect available n8n node types. Run 'nodes sync' first.",
      commands: [
        { name: "sync",       synopsis: "nodes sync", description: "Extract node definitions from the connected n8n instance and cache locally per profile. Tries /types/nodes.json, /api/v1/node-types, and workflow fallback." },
        { name: "list",       synopsis: "nodes list [--category trigger|action|ai|transform|flow|output|utility] [--limit n] [--fields f1,f2]", description: "List cached node types. Use --category to filter." },
        { name: "get",        synopsis: "nodes get <n8nType>", description: "Get full definition of a node type including all parameters, credentials, inputs and outputs. e.g. nodes get n8n-nodes-base.slack" },
        { name: "search",     synopsis: "nodes search <query> [--limit n]", description: "Search nodes by natural language (e.g. 'send email', 'slack message', 'AI agent'). Returns scored results." },
        { name: "categories", synopsis: "nodes categories", description: "List available node categories with counts." },
      ],
    },
    {
      name: "workflows",
      description: "Create, read, update, delete and manage workflows",
      commands: [
        { name: "list",         synopsis: "workflows list [--active] [--inactive] [--tags t1,t2] [--name str] [--project-id id] [--limit n] [--cursor str] [--all] [--fields f1,f2]", description: "List workflows. Use --active/--inactive to filter by status." },
        { name: "get",          synopsis: "workflows get <id> [--exclude-pinned-data] [--fields f1,f2]", description: "Get full workflow definition including nodes and connections." },
        { name: "create",       synopsis: "workflows create [--name str] [--data json] [--active] [--fields f1,f2]", description: "Create a workflow. Body can be piped as JSON via stdin or passed with --data." },
        { name: "update",       synopsis: "workflows update <id> [--name str] [--data json] [--active] [--inactive] [--fields f1,f2]", description: "Update a workflow. Provide only the fields to change." },
        { name: "delete",       synopsis: "workflows delete <id>", description: "Permanently delete a workflow and all its execution history." },
        { name: "activate",     synopsis: "workflows activate <id>", description: "Activate a workflow (enables triggers)." },
        { name: "deactivate",   synopsis: "workflows deactivate <id>", description: "Deactivate a workflow (disables triggers)." },
        { name: "tags",         synopsis: "workflows tags <id>", description: "Get tags associated with a workflow." },
        { name: "set-tags",     synopsis: "workflows set-tags <id> --tag-ids id1,id2", description: "Replace all tags on a workflow. Provide complete desired list." },
        { name: "transfer",     synopsis: "workflows transfer <id> --project-id <destId>", description: "Move a workflow to a different project." },
        { name: "history",      synopsis: "workflows history <id> [--limit n] [--cursor str] [--all]", description: "List version history of a workflow." },
        { name: "history-get",  synopsis: "workflows history-get <id> <versionId>", description: "Get a specific historical version of a workflow." },
      ],
    },
    {
      name: "executions",
      description: "View, delete, and retry workflow executions",
      commands: [
        { name: "list",   synopsis: "executions list [--workflow-id id] [--status status] [--include-data] [--limit n] [--cursor str] [--all] [--fields f1,f2]", description: "List executions. Filter by workflowId and/or status (success|error|canceled|running|waiting|new)." },
        { name: "get",    synopsis: "executions get <id> [--include-data] [--fields f1,f2]", description: "Get a single execution. Use --include-data to get full node input/output data." },
        { name: "delete", synopsis: "executions delete <id>", description: "Delete an execution and its data." },
        { name: "retry",  synopsis: "executions retry <id> [--load-workflow]", description: "Retry a failed execution. --load-workflow uses the latest workflow version instead of the original snapshot." },
      ],
    },
    {
      name: "credentials",
      description: "Manage n8n credentials for external services",
      commands: [
        { name: "list",     synopsis: "credentials list [--include-data] [--limit n] [--cursor str] [--all] [--fields f1,f2]", description: "List credentials. Use --include-data only when necessary (sensitive data)." },
        { name: "get",      synopsis: "credentials get <id> [--include-data] [--fields f1,f2]", description: "Get a credential by ID." },
        { name: "schema",   synopsis: "credentials schema <type>", description: "Get the required fields for a credential type before creating it. e.g. slackApi, openAiApi, googleDriveOAuth2Api, postgresDb." },
        { name: "create",   synopsis: "credentials create --name str --type str [--data json]", description: "Create a credential. Always call schema first to know required fields." },
        { name: "update",   synopsis: "credentials update <id> [--name str] [--data json]", description: "Update credential name or data." },
        { name: "delete",   synopsis: "credentials delete <id>", description: "Permanently delete a credential." },
        { name: "transfer", synopsis: "credentials transfer <id> --project-id <destId>", description: "Transfer credential to another project." },
      ],
    },
    {
      name: "tags",
      description: "Manage tags for organizing workflows",
      commands: [
        { name: "list",   synopsis: "tags list [--with-usage-count] [--limit n] [--cursor str] [--all]", description: "List all tags." },
        { name: "get",    synopsis: "tags get <id>", description: "Get a tag by ID." },
        { name: "create", synopsis: "tags create --name str", description: "Create a new tag." },
        { name: "update", synopsis: "tags update <id> --name str", description: "Rename a tag." },
        { name: "delete", synopsis: "tags delete <id>", description: "Delete a tag (removes it from all workflows)." },
      ],
    },
    {
      name: "variables",
      description: "Manage instance-level variables (accessible in workflows via $vars.key)",
      commands: [
        { name: "list",   synopsis: "variables list [--limit n] [--cursor str] [--all]", description: "List all instance variables." },
        { name: "create", synopsis: "variables create --key str --value str [--type string]", description: "Create a variable. Access in workflows with $vars.KEY." },
        { name: "delete", synopsis: "variables delete <id>", description: "Delete a variable." },
      ],
    },
    {
      name: "users",
      description: "Manage n8n users (requires Admin or Owner role)",
      commands: [
        { name: "list",   synopsis: "users list [--include-role] [--project-id id] [--limit n] [--cursor str] [--all]", description: "List users." },
        { name: "get",    synopsis: "users get <idOrEmail> [--include-role]", description: "Get a user by ID or email address." },
        { name: "create", synopsis: "users create --data '[{\"email\":\"x@y.com\",\"role\":\"member\"}]'", description: "Invite users. Body is a JSON array of {email, role} objects." },
        { name: "update", synopsis: "users update <id> --role owner|admin|member", description: "Update a user's role." },
        { name: "delete", synopsis: "users delete <id> [--transfer-to <userId>]", description: "Delete a user. Use --transfer-to to transfer their assets before deleting." },
      ],
    },
    {
      name: "projects",
      description: "Manage projects for organizing workflows and credentials (Enterprise)",
      commands: [
        { name: "list",   synopsis: "projects list [--limit n] [--cursor str] [--all]", description: "List all projects." },
        { name: "create", synopsis: "projects create --name str", description: "Create a project." },
        { name: "update", synopsis: "projects update <id> --name str", description: "Rename a project." },
        { name: "delete", synopsis: "projects delete <id>", description: "Delete a project." },
      ],
    },
    {
      name: "audit",
      description: "Security audit of the n8n instance",
      commands: [
        { name: "run", synopsis: "audit run [--categories credentials,database,filesystem,instance,nodes,workflows] [--days-abandoned 90]", description: "Generate a security audit. Returns risk findings per category. Available categories: credentials, database, filesystem, instance, nodes, workflows." },
      ],
    },
    {
      name: "source-control",
      description: "Git-based source control integration (requires Enterprise + connected repo)",
      commands: [
        { name: "pull",   synopsis: "source-control pull [--force]", description: "Pull workflow changes from the connected Git repository." },
        { name: "status", synopsis: "source-control status", description: "Get current source control configuration and status." },
      ],
    },
    {
      name: "ldap",
      description: "LDAP configuration and sync (Enterprise)",
      commands: [
        { name: "config",    synopsis: "ldap config", description: "Get current LDAP configuration." },
        { name: "sync",      synopsis: "ldap sync [--dry-run]", description: "Run LDAP sync. Use --dry-run to preview without applying." },
        { name: "sync-list", synopsis: "ldap sync-list [--limit n] [--cursor str]", description: "List LDAP sync history." },
      ],
    },
    {
      name: "meta",
      description: "Machine-readable CLI metadata for AI consumption",
      commands: [
        { name: "schema",             synopsis: "meta schema", description: "Full CLI schema as JSON: all commands, options, examples, and exit codes." },
        { name: "exit-codes",         synopsis: "meta exit-codes", description: "Explain what each exit code means." },
        { name: "common-options",     synopsis: "meta common-options", description: "Options available on most commands (--all, --fields, --limit, --cursor)." },
        { name: "patterns",           synopsis: "meta patterns", description: "Common usage patterns and recipes for AI agents." },
        { name: "workflow-template",  synopsis: "meta workflow-template", description: "Complete workflow JSON template with all fields documented, connection types, and expression syntax." },
        { name: "credential-guide",   synopsis: "meta credential-guide", description: "Step-by-step guide: how to discover, create, and map credentials into workflow nodes." },
        { name: "ai-recipes",         synopsis: "meta ai-recipes", description: "Multi-step operation recipes for AI agents: build workflow, clone, debug, audit, AI agent setup." },
      ],
    },
    {
      name: "help-ai",
      description: "Human-readable command reference organized by group",
      commands: [
        { name: "all",          synopsis: "help-ai all", description: "Print complete command reference as JSON." },
        { name: "group <name>", synopsis: "help-ai group <name>", description: "Print reference for one group (e.g. help-ai group workflows)." },
        { name: "list-groups",  synopsis: "help-ai list-groups", description: "List available groups." },
      ],
    },
  ],
};
