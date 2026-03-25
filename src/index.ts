#!/usr/bin/env node
import { Command } from "commander";
import { setSelectedProfile } from "./config.js";
import { workflowsCmd }     from "./commands/workflows.js";
import { executionsCmd }    from "./commands/executions.js";
import { credentialsCmd }   from "./commands/credentials.js";
import {
  tagsCmd,
  variablesCmd,
  usersCmd,
  projectsCmd,
  auditCmd,
  sourceControlCmd,
  ldapCmd,
} from "./commands/misc.js";
import { helpCmd, metaCmd } from "./commands/help.js";
import { profileCmd }       from "./commands/profile.js";
import { nodesCmd }         from "./commands/nodes.js";

const program = new Command();

program
  .name("n8n-cli")
  .description(
    "CLI for the n8n REST API.\n" +
    "All stdout is valid JSON. All errors go to stderr as JSON.\n" +
    "Exit 0 = success | Exit 1 = API error | Exit 2 = usage error\n\n" +
    "Tip for AI agents: run 'meta schema' once to get the full command reference."
  )
  .version("1.0.0")
  .option("--profile <name>", "Use a specific connection profile instead of the default")
  .on("option:profile", (name: string) => {
    setSelectedProfile(name);
  })
  .addHelpText("after", `
Setup with profiles (recommended):
  n8n-cli profile add local --base-url http://localhost:5678 --api-key <key>
  n8n-cli profile add prod  --base-url https://n8n.example.com --api-key <key>
  n8n-cli profile use local
  n8n-cli --profile prod workflows list

Setup with env vars (alternative):
  export N8N_BASE_URL=http://localhost:5678
  export N8N_API_KEY=your_api_key

Quick reference:
  node dist/index.js meta schema          Full machine-readable schema
  node dist/index.js meta patterns        Common usage patterns
  node dist/index.js help-ai list-groups  List all command groups
  node dist/index.js help-ai group workflows

Examples:
  node dist/index.js workflows list --all --fields id,name,active
  node dist/index.js workflows get <id>
  node dist/index.js --profile prod executions list --status error --all
  node dist/index.js credentials schema slackApi
  node dist/index.js audit run --categories credentials,workflows
`);

program.addCommand(profileCmd());
program.addCommand(nodesCmd());
program.addCommand(workflowsCmd());
program.addCommand(executionsCmd());
program.addCommand(credentialsCmd());
program.addCommand(tagsCmd());
program.addCommand(variablesCmd());
program.addCommand(usersCmd());
program.addCommand(projectsCmd());
program.addCommand(auditCmd());
program.addCommand(sourceControlCmd());
program.addCommand(ldapCmd());
program.addCommand(metaCmd());
program.addCommand(helpCmd());

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(JSON.stringify({ error: "unexpected", message: err.message }) + "\n");
  process.exit(1);
});
