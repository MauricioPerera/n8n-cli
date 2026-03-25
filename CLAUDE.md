# n8n-cli — AI Agent Skill Definition

## What is this CLI?

n8n-cli is a JSON-first wrapper for the n8n REST API. Every command outputs valid JSON to stdout. Every error outputs JSON to stderr. Exit codes: 0=success, 1=API error, 2=usage error.

**Two runtime dependencies**: axios, commander. No bloat.

## First-time setup (run once)

```bash
# 1. Load the full command reference
n8n-cli meta schema

# 2. Sync the node catalog from the connected instance
n8n-cli nodes sync

# 3. Check available credentials
n8n-cli credentials list --fields id,name,type --all
```

## How to build a workflow from scratch

### Step 1: Discover nodes

```bash
n8n-cli nodes search "send slack message"
n8n-cli nodes search "webhook trigger"
n8n-cli nodes search "AI agent"
```

### Step 2: Get node parameter schemas

```bash
n8n-cli nodes get n8n-nodes-base.slack
n8n-cli nodes get n8n-nodes-base.webhook
```

The output includes `properties[]` with every parameter's name, type, required flag, options, and defaults.

### Step 3: Check available credentials

```bash
n8n-cli credentials list --fields id,name,type --all
n8n-cli credentials schema slackApi   # see what fields are needed
```

### Step 4: Compose the workflow JSON

Use the template below and fill in nodes/connections.

### Step 5: Deploy

```bash
n8n-cli workflows create --data '<workflow-json>'
n8n-cli workflows activate <returned-id>
```

## Workflow JSON structure

This is the exact format n8n expects:

```json
{
  "name": "My Workflow",
  "nodes": [
    {
      "name": "Webhook Trigger",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [0, 0],
      "parameters": {
        "httpMethod": "POST",
        "path": "my-hook"
      },
      "webhookId": "optional-uuid"
    },
    {
      "name": "Send Slack Message",
      "type": "n8n-nodes-base.slack",
      "typeVersion": 2,
      "position": [250, 0],
      "parameters": {
        "resource": "message",
        "operation": "post",
        "channel": { "__rl": true, "mode": "name", "value": "#general" },
        "text": "={{ $json.body.message }}"
      },
      "credentials": {
        "slackApi": {
          "id": "<credential-id-from-credentials-list>",
          "name": "My Slack Token"
        }
      }
    }
  ],
  "connections": {
    "Webhook Trigger": {
      "main": [
        [
          {
            "node": "Send Slack Message",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "settings": {
    "executionOrder": "v1"
  }
}
```

### Key rules

- **`nodes[].name`**: Display name, must be unique within the workflow. Used as key in `connections`.
- **`nodes[].type`**: The `n8nType` from `nodes get`. Exact string, case-sensitive.
- **`nodes[].typeVersion`**: Use the latest version from `nodes get` → `version[]`.
- **`nodes[].position`**: `[x, y]` pixel coordinates. Space nodes ~250px apart horizontally.
- **`nodes[].parameters`**: Keys must match `properties[].name` from `nodes get`.
- **`nodes[].credentials`**: Object keyed by credential type name (e.g. `"slackApi"`), value is `{ "id": "<id>", "name": "<display-name>" }`. Get ID from `credentials list`.

### Connection format

```
connections: {
  "<source-node-name>": {
    "<output-type>": [          // "main" for most nodes
      [                         // output index 0
        {
          "node": "<target-node-name>",
          "type": "<input-type>",   // "main" for most nodes
          "index": 0                // input index
        }
      ]
    ]
  }
}
```

**Output/input types**: Most nodes use `"main"`. AI nodes use specialized types:
- `"ai_agent"` — connects to AI agent nodes
- `"ai_memory"` — memory provider connections
- `"ai_tool"` — tool connections for AI agents
- `"ai_languageModel"` — LLM provider connections
- `"ai_vectorStore"` — vector store connections
- `"ai_outputParser"` — output parser connections

### Credentials in nodes

Credentials are NOT passed as parameters. They go in a separate `credentials` field on the node:

```json
{
  "name": "Gmail Send",
  "type": "n8n-nodes-base.gmail",
  "parameters": { "operation": "send", "to": "user@example.com" },
  "credentials": {
    "gmailOAuth2": {
      "id": "abc123",
      "name": "My Gmail"
    }
  }
}
```

To find the credential type name: check `nodes get <type>` → `credentials[]` array.
To find the credential ID: `credentials list --fields id,name,type --all`.

## Expression syntax

n8n uses `={{ }}` for expressions inside parameter values:

- `={{ $json.fieldName }}` — access current item data
- `={{ $('Node Name').item.json.field }}` — access data from another node
- `={{ $input.first().json.field }}` — first input item
- `={{ $now.toISO() }}` — current timestamp
- `={{ $vars.MY_VAR }}` — instance variable

## Common patterns

### Create a workflow from stdin

```bash
cat workflow.json | n8n-cli workflows create
```

### List all workflows compactly

```bash
n8n-cli workflows list --all --fields id,name,active
```

### Find and retry failed executions

```bash
n8n-cli executions list --workflow-id <id> --status error --all --fields id
# Then retry each one
n8n-cli executions retry <exec-id>
```

### Clone a workflow to another instance

```bash
n8n-cli --profile source workflows get <id> > workflow.json
cat workflow.json | n8n-cli --profile target workflows create
```

### Create a credential then use it

```bash
# 1. Check required fields
n8n-cli credentials schema slackApi

# 2. Create it
n8n-cli credentials create --name "Prod Slack" --type slackApi --data '{"accessToken":"xoxb-..."}'

# 3. Use the returned ID in your workflow nodes
```

### Debug a failing workflow

```bash
# Check execution details with full node I/O
n8n-cli executions list --workflow-id <id> --status error --limit 1
n8n-cli executions get <exec-id> --include-data
```

## Error handling

All errors are JSON on stderr:

```json
{"error": "api_error", "status": 404, "message": "Workflow not found"}
```

| Error | Meaning | Fix |
|-------|---------|-----|
| `missing_config` | No profile or env vars set | Run `profile add` or set `N8N_BASE_URL`+`N8N_API_KEY` |
| `no_catalog` | Node catalog not synced | Run `nodes sync` |
| `not_found` | Resource doesn't exist | Check the ID is correct |
| `api_error` + status 401 | Invalid API key | Update key with `profile update` |
| `api_error` + status 403 | Insufficient permissions | Check API key scope in n8n Settings |
| `api_error` + status 409 | Conflict (e.g. duplicate name) | Use a different name |

## Project structure

```
src/
  index.ts          — CLI entry point
  api.ts            — HTTP client, JSON I/O (get, getAll, post, put, patch, del, readStdin, out)
  config.ts         — Profile management (~/.n8n-cli/config.json)
  catalog.ts        — Node extraction, cache, search (~/.n8n-cli/catalog/)
  commands/
    profile.ts      — profile add/remove/use/list/show/update
    nodes.ts        — nodes sync/list/get/search/categories
    workflows.ts    — workflows CRUD + activate/deactivate/tags/transfer/history
    executions.ts   — executions list/get/delete/retry
    credentials.ts  — credentials CRUD + schema
    misc.ts         — tags, variables, users, projects, audit, source-control, ldap
    help.ts         — meta schema/patterns/exit-codes + help-ai commands
```
