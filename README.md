# n8n-cli

CLI for the n8n REST API. Designed for AI agents and automation pipelines.

- **All stdout is valid JSON** — pipe-friendly, machine-readable
- **All errors go to stderr as JSON** — structured error handling
- **Multi-instance profiles** — manage local, staging, production from one CLI
- **Node catalog with search** — discover n8n nodes and their parameters before building workflows
- **Zero config** — works with env vars or profile files
- **Only 1 runtime dependency** — commander (uses Node.js native `fetch`)

## Quick Start

```bash
# Install
git clone https://github.com/MauricioPerera/n8n-cli.git
cd n8n-cli
npm install
npm run build

# Configure a profile
n8n-cli profile add local --base-url http://localhost:5678 --api-key <your-key>

# Or use environment variables
export N8N_BASE_URL=http://localhost:5678
export N8N_API_KEY=your_api_key

# Start using
n8n-cli workflows list --all --fields id,name,active
```

### Requirements

- Node.js >= 18
- An n8n instance with API access enabled (Settings > n8n API)

### Global install (optional)

```bash
npm link   # makes 'n8n-cli' available system-wide
```

## Multi-Instance Profiles

Manage multiple n8n instances with named profiles:

```bash
# Add profiles
n8n-cli profile add local   --base-url http://localhost:5678 --api-key <key>
n8n-cli profile add prod    --base-url https://n8n.example.com --api-key <key>
n8n-cli profile add staging --base-url https://staging.n8n.example.com --api-key <key>

# Switch default
n8n-cli profile use prod

# Use a specific profile for one command
n8n-cli --profile staging workflows list

# List all profiles (API keys are masked)
n8n-cli profile list

# Show current profile details
n8n-cli profile show
```

**Configuration priority** (highest to lowest):
1. Environment variables (`N8N_BASE_URL`, `N8N_API_KEY`, `N8N_TIMEOUT`)
2. Local `.n8nrc` file in the current directory (per-project overrides)
3. Global `~/.n8n-cli/config.json`

## Node Catalog

Build a local knowledge base of all n8n node types available in your instance. Essential for AI agents that need to compose workflows correctly.

```bash
# Sync node definitions from your instance (run once per instance)
n8n-cli nodes sync

# Search for nodes by natural language
n8n-cli nodes search "send email"
n8n-cli nodes search "AI agent"
n8n-cli nodes search "database query"

# Get full definition with all parameters, credentials, inputs/outputs
n8n-cli nodes get n8n-nodes-base.gmail

# Browse by category
n8n-cli nodes list --category trigger
n8n-cli nodes list --category ai
n8n-cli nodes categories
```

The catalog is stored per-profile at `~/.n8n-cli/catalog/{profileName}.json`.

**Extraction strategies** (automatic fallback):
1. `/types/nodes.json` — static node catalog
2. `/api/v1/node-types` — public API (n8n >= 1.113)
3. `/rest/node-types` — internal API (cookie auth)
4. Workflow analysis — extracts unique node types from existing workflows

## Command Reference

### Profile Management

| Command | Description |
|---------|-------------|
| `profile list` | List all configured profiles |
| `profile add <name> --base-url <url> --api-key <key>` | Add a new profile |
| `profile update <name> [--base-url] [--api-key] [--timeout]` | Update profile |
| `profile remove <name>` | Remove a profile |
| `profile use <name>` | Set default profile |
| `profile show [name]` | Show profile details (masked API key) |

### Node Catalog

| Command | Description |
|---------|-------------|
| `nodes sync` | Extract and cache node definitions from instance |
| `nodes list [--category <cat>] [--limit n]` | List cached nodes |
| `nodes get <n8nType>` | Full node definition (params, creds, I/O) |
| `nodes search <query> [--limit n]` | Search by natural language |
| `nodes categories` | Category summary with counts |

Categories: `trigger`, `action`, `ai`, `transform`, `flow`, `output`, `utility`

### Workflows

```bash
n8n-cli workflows list [--active] [--inactive] [--tags t1,t2] [--name str] [--all] [--fields id,name]
n8n-cli workflows get <id> [--exclude-pinned-data]
n8n-cli workflows create [--name str] [--data '{}'] [--active]
n8n-cli workflows update <id> [--name str] [--data '{}'] [--active] [--inactive]
n8n-cli workflows delete <id>
n8n-cli workflows activate <id>
n8n-cli workflows deactivate <id>
n8n-cli workflows tags <id>
n8n-cli workflows set-tags <id> --tag-ids id1,id2
n8n-cli workflows transfer <id> --project-id <destId>
n8n-cli workflows history <id>
n8n-cli workflows history-get <id> <versionId>
```

### Executions

```bash
n8n-cli executions list [--workflow-id <id>] [--status error] [--include-data] [--all]
n8n-cli executions get <id> [--include-data]
n8n-cli executions delete <id>
n8n-cli executions retry <id> [--load-workflow]
```

### Credentials

```bash
n8n-cli credentials list [--include-data]
n8n-cli credentials get <id> [--include-data]
n8n-cli credentials schema <type>       # e.g. slackApi, openAiApi
n8n-cli credentials create --name "My Slack" --type slackApi --data '{"token":"xoxb-..."}'
n8n-cli credentials update <id> [--name str] [--data '{}']
n8n-cli credentials delete <id>
n8n-cli credentials transfer <id> --project-id <destId>
```

### Tags, Variables, Users, Projects

```bash
n8n-cli tags list [--with-usage-count] | tags create --name str | tags update <id> --name str | tags delete <id>
n8n-cli variables list | variables create --key str --value str | variables delete <id>
n8n-cli users list [--include-role] | users get <idOrEmail> | users create --data '[...]' | users delete <id>
n8n-cli projects list | projects create --name str | projects update <id> --name str | projects delete <id>
```

### Audit, Source Control, LDAP

```bash
n8n-cli audit run [--categories credentials,workflows]
n8n-cli source-control pull [--force]
n8n-cli source-control status
n8n-cli ldap config | ldap sync [--dry-run] | ldap sync-list
```

### AI Agent Helpers

```bash
n8n-cli meta schema              # Full machine-readable CLI schema (JSON)
n8n-cli meta patterns            # Common usage patterns for AI agents
n8n-cli meta exit-codes          # Exit code reference
n8n-cli meta common-options      # Standard options reference
n8n-cli help-ai all              # Complete command reference
n8n-cli help-ai group workflows  # Reference for one command group
n8n-cli help-ai list-groups      # List all command groups
```

## Common Options

| Option | Description |
|--------|-------------|
| `--profile <name>` | Use a specific profile instead of default |
| `--fields <f1,f2>` | Return only specified fields (client-side filter) |
| `--all` | Auto-paginate and return ALL results |
| `--limit <n>` | Max results per page (default: 10, max: 250) |
| `--cursor <str>` | Pagination cursor from previous response |
| `--data <json>` | Inline JSON body for create/update commands |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success — stdout contains valid JSON |
| `1` | API/runtime error — stderr contains `{"error","status","message"}` |
| `2` | Usage error — wrong arguments, missing config |

## AI Agent Workflow

The recommended pattern for an AI building n8n workflows:

```bash
# 1. Sync the node catalog (once per instance)
n8n-cli nodes sync

# 2. Discover what nodes exist
n8n-cli nodes search "send slack message"

# 3. Get exact parameter schema for the chosen node
n8n-cli nodes get n8n-nodes-base.slack

# 4. Check available credentials
n8n-cli credentials list --fields id,name,type

# 5. Build and deploy the workflow
n8n-cli workflows create --data '{
  "name": "Slack Notifier",
  "nodes": [...],
  "connections": {...},
  "settings": {"executionOrder": "v1"}
}'

# 6. Activate it
n8n-cli workflows activate <id>
```

## Examples with jq

```bash
# Names of all active workflows
n8n-cli workflows list --all | jq '.data[] | select(.active) | .name'

# IDs of failed executions
n8n-cli executions list --status error --all | jq '.data[].id'

# Retry all failed executions for a workflow
n8n-cli executions list --workflow-id <id> --status error --all \
  | jq -r '.data[].id' \
  | xargs -I{} n8n-cli executions retry {}

# Export all workflows to individual files
n8n-cli workflows list --all --fields id \
  | jq -r '.data[].id' \
  | xargs -I{} sh -c 'n8n-cli workflows get {} > {}.json'

# Check what fields a credential type needs
n8n-cli credentials schema slackApi | jq '.properties[] | {name, type, required}'

# Find all AI-related nodes
n8n-cli nodes list --category ai | jq '.data[].n8nType'
```

## Testing

### Integration Tests

```bash
npm test                           # Test default profile
npm run test:all                   # Test ALL configured profiles
node tests/run.js --profile prod   # Test a specific profile
```

### Comprehensive Test Suite

A full verification suite (`tests/suite.js`) covering **420+ assertions** across all command groups:

```bash
node tests/suite.js                        # Test default profile
node tests/suite.js --profile local        # Test specific profile
node tests/suite.js --all-profiles         # Test every configured profile
node tests/suite.js --group workflows      # Run only one group
node tests/suite.js --verbose              # Show details on failure
```

**Coverage by group:**

| Group | Assertions | What it verifies |
|-------|-----------|-----------------|
| profile | 58 | CRUD (add/show/update/use/remove), API key masking, error paths (duplicate, nonexistent) |
| workflows | 57 | List (filters, --all, --fields), CRUD, activate/deactivate with webhook trigger, set-tags, stdin input, error paths |
| executions | 25 | List (status/workflow filters), get, --include-data, --fields, retry, error paths |
| credentials | 21 | List, schema discovery, create via stdin, delete, graceful handling of version-specific API differences (405) |
| tags | 33 | CRUD, assign/unassign tags to workflows, duplicate name detection |
| variables | 1+ | Enterprise feature detection with graceful skip |
| users | 16 | List, --include-role, get by ID, error paths |
| projects | 1+ | Enterprise feature detection |
| audit | 5 | Full run + category-filtered run |
| nodes | 72 | Sync, list (5 categories), search (6 queries + score ordering + limit), get (known nodes + fuzzy suggestions), --fields |
| meta | 47 | Full schema validation (groups, exit_codes, patterns, environment), workflow-template, credential-guide, ai-recipes |
| help-ai | 36 | list-groups, every group individually, all, nonexistent group error |
| edge-cases | 22 | --fields on empty results, --limit 0/250, --profile invalid, JSON response consistency, clean stderr on success |

Results are saved to `tests/suite-results.json` after each run.

### Benchmark

Compare latency and throughput across profiles:

```bash
node tests/benchmark.js                    # Benchmark all profiles
node tests/benchmark.js --profile local    # Benchmark one profile
node tests/benchmark.js --iterations 5     # Custom iteration count
```

Measures avg/min/max/p95 latency for read ops, write cycles (create+delete), node catalog, meta commands, audit, and error handling. Results saved to `tests/benchmark-results.json`.

## Project Structure

```
src/
  index.ts            # CLI entry point, Commander setup
  api.ts              # HTTP client (native fetch), JSON I/O helpers
  lib.ts              # Library exports (config + catalog, no Commander dependency)
  config.ts           # Profile management, config file loading
  catalog.ts          # Node extraction, caching, search engine
  commands/
    profile.ts        # profile add/remove/use/list/show/update
    nodes.ts          # nodes sync/list/get/search/categories
    workflows.ts      # workflows CRUD + activate/deactivate/tags
    executions.ts     # executions list/get/delete/retry
    credentials.ts    # credentials CRUD + schema discovery
    misc.ts           # tags, variables, users, projects, audit, source-control, ldap
    help.ts           # meta schema, patterns, help-ai reference
tests/
  run.js              # Integration test runner (multi-profile)
  suite.js            # Comprehensive test suite (420+ assertions)
  benchmark.js        # Latency/throughput benchmark (multi-profile)
```

## Configuration Files

| File | Purpose |
|------|---------|
| `~/.n8n-cli/config.json` | Global profiles (base URLs, API keys) |
| `~/.n8n-cli/catalog/{profile}.json` | Cached node catalogs per profile |
| `.n8nrc` | Per-project profile overrides |

## Library Usage

The core modules (config, catalog, search) can be imported directly without the CLI framework:

```typescript
import {
  loadConfig,
  resolveProfile,
  loadCatalog,
  syncCatalog,
  searchNodes,
} from "n8n-cli/lib";

// Read profiles
const config = loadConfig();
console.log(Object.keys(config.profiles)); // ["local", "prod", "staging"]

// Load cached node catalog
const catalog = loadCatalog("local");
console.log(catalog.nodeCount); // 436

// Search nodes
const results = searchNodes(catalog.nodes, "send email", 5);
results.forEach(r => console.log(r.node.n8nType, r.score));
```

This is used by [n8n-a2e](https://github.com/MauricioPerera/n8n-a2e) to read catalog files and profiles without spawning CLI subprocesses.

## Security

### Supply Chain

As of v1.1.0, n8n-cli uses **Node.js native `fetch`** (available since Node 18) instead of axios. This eliminates the primary supply chain attack surface — the [axios npm compromise of March 2026](https://www.microsoft.com/en-us/security/blog/2026/04/01/mitigating-the-axios-npm-supply-chain-compromise/) demonstrated the risk of depending on high-profile HTTP libraries.

**Runtime dependencies:** Only `commander` (CLI argument parsing). Zero HTTP libraries.

### API Keys

- Stored in `~/.n8n-cli/config.json` (user-readable only)
- Masked in all display output (first 8 + last 4 chars)
- Never logged or included in error output
- Environment variables take priority over stored keys

## Dependencies

| Package | Purpose | Type |
|---------|---------|------|
| `commander` | CLI argument parsing | runtime |
| `typescript` | Type checking | dev |
| `sucrase` | Fast transpilation | dev |
| `@types/node` | Node.js type definitions | dev |

## Related

- [n8n-a2e](https://github.com/MauricioPerera/n8n-a2e) — AI workflow composer that uses n8n-cli catalogs for node discovery
- [n8n API docs](https://docs.n8n.io/api/)

## License

MIT
