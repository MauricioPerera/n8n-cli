#!/usr/bin/env node
/**
 * n8n-cli Integration Test Runner
 *
 * Runs integration tests against configured profiles.
 * Usage:
 *   node tests/run.js                   # test default profile
 *   node tests/run.js --profile local   # test specific profile
 *   node tests/run.js --all-profiles    # test every configured profile
 */

const { execSync } = require("child_process");
const path = require("path");

const CLI = path.join(__dirname, "..", "dist", "index.js");
const args = process.argv.slice(2);

// ─── Helpers ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

function run(cmd, { expectFail = false, stdin } = {}) {
  const fullCmd = `node ${CLI} ${cmd}`;
  try {
    const result = execSync(fullCmd, {
      encoding: "utf8",
      timeout: 30000,
      input: stdin,
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (expectFail) return { ok: false, stdout: result, stderr: "" };
    return { ok: true, stdout: result, stderr: "" };
  } catch (err) {
    if (expectFail) return { ok: true, stdout: err.stdout || "", stderr: err.stderr || "", exitCode: err.status };
    return { ok: false, stdout: err.stdout || "", stderr: err.stderr || "", exitCode: err.status };
  }
}

function parseJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function assert(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    const msg = `  ❌ ${name}${detail ? ` — ${detail}` : ""}`;
    console.log(msg);
    failures.push(msg);
  }
}

function skip(name, reason) {
  skipped++;
  console.log(`  ⏭️  ${name} (${reason})`);
}

// ─── Test Suites ────────────────────────────────────────────────────────────

function testProfile(profileFlag) {
  const pf = profileFlag ? `${profileFlag} ` : "";

  console.log("\n📋 Profile Commands");

  const r0 = run("profile list");
  const profiles = parseJSON(r0.stdout);
  assert("profile list returns array", Array.isArray(profiles));
  if (profiles) {
    assert("profiles have expected keys", profiles.every(p => p.name && p.baseUrl && p.apiKey));
    assert("api keys are masked", profiles.every(p => p.apiKey.includes("...")));
  }

  const r0b = run("profile show");
  const show = parseJSON(r0b.stdout);
  assert("profile show returns object", show && typeof show === "object" && show.name);

  console.log("\n🔗 Connectivity");

  const r1 = run(`${pf}workflows list --limit 1 --fields id,name`);
  assert("workflows list succeeds", r1.ok);
  const wfList = parseJSON(r1.stdout);
  assert("workflows list returns valid JSON", wfList !== null);
  assert("workflows list has data array", wfList && Array.isArray(wfList.data));
  if (wfList?.data?.length > 0) {
    assert("--fields filter works", Object.keys(wfList.data[0]).length <= 3); // id, name + maybe nextCursor
  }

  console.log("\n📦 Workflows CRUD");

  // Create
  const createData = JSON.stringify({ name: "__test_cli_workflow__", nodes: [], connections: {}, settings: { executionOrder: "v1" } });
  const r2 = run(`${pf}workflows create --data "${createData.replace(/"/g, '\\"')}"`);
  assert("workflows create succeeds", r2.ok);
  const created = parseJSON(r2.stdout);
  assert("created workflow has id", created && created.id);
  const wfId = created?.id;

  if (wfId) {
    // Get
    const r3 = run(`${pf}workflows get ${wfId} --fields id,name,active`);
    assert("workflows get succeeds", r3.ok);
    const fetched = parseJSON(r3.stdout);
    assert("get returns correct workflow", fetched && fetched.id === wfId);
    assert("get --fields filters output", fetched && Object.keys(fetched).length <= 3);

    // Update
    const r4 = run(`${pf}workflows update ${wfId} --name __test_cli_updated__`);
    assert("workflows update succeeds", r4.ok);
    const updated = parseJSON(r4.stdout);
    assert("update changes name", updated && updated.name === "__test_cli_updated__");

    // Activate / Deactivate (may fail if workflow has no trigger node — that's expected)
    const r5 = run(`${pf}workflows activate ${wfId}`);
    if (r5.ok) {
      const activated = parseJSON(r5.stdout);
      assert("workflows activate succeeds", true);
      assert("workflow is active after activate", activated && activated.active === true);

      const r6 = run(`${pf}workflows deactivate ${wfId}`);
      assert("workflows deactivate succeeds", r6.ok);
      const deactivated = parseJSON(r6.stdout);
      assert("workflow is inactive after deactivate", deactivated && deactivated.active === false);
    } else {
      skip("workflows activate", "workflow has no trigger — cannot activate (expected)");
      skip("workflows deactivate", "skipped because activate was skipped");
    }

    // Tags (list for workflow)
    const r6b = run(`${pf}workflows tags ${wfId}`);
    assert("workflows tags succeeds", r6b.ok);

    // Delete
    const r7 = run(`${pf}workflows delete ${wfId}`);
    assert("workflows delete succeeds", r7.ok);
  } else {
    skip("workflow get/update/activate/deactivate/delete", "create failed");
  }

  console.log("\n⚡ Executions");

  const r8 = run(`${pf}executions list --limit 2 --fields id,status`);
  assert("executions list succeeds", r8.ok);
  const execs = parseJSON(r8.stdout);
  assert("executions list returns valid JSON", execs !== null);

  console.log("\n🔑 Credentials");

  const r9 = run(`${pf}credentials list --limit 2 --fields id,name,type`);
  assert("credentials list succeeds", r9.ok);
  const creds = parseJSON(r9.stdout);
  assert("credentials list returns valid JSON", creds !== null);

  // Schema discovery
  const r9b = run(`${pf}credentials schema httpHeaderAuth`);
  assert("credentials schema succeeds", r9b.ok);
  const schema = parseJSON(r9b.stdout);
  assert("credentials schema returns JSON", schema !== null);

  console.log("\n🏷️  Tags");

  const r10 = run(`${pf}tags list --limit 5`);
  assert("tags list succeeds", r10.ok);

  // Tag CRUD
  const r10b = run(`${pf}tags create --name __test_cli_tag__`);
  assert("tags create succeeds", r10b.ok);
  const tag = parseJSON(r10b.stdout);
  if (tag?.id) {
    const r10c = run(`${pf}tags update ${tag.id} --name __test_cli_tag_renamed__`);
    assert("tags update succeeds", r10c.ok);
    const r10d = run(`${pf}tags delete ${tag.id}`);
    assert("tags delete succeeds", r10d.ok);
  }

  console.log("\n👥 Users");

  const r11 = run(`${pf}users list --limit 2`);
  assert("users list succeeds", r11.ok);

  console.log("\n📁 Projects");

  const r12 = run(`${pf}projects list --limit 2`);
  if (r12.ok) {
    assert("projects list succeeds", true);
  } else {
    skip("projects list", "Enterprise feature — may not be available");
  }

  console.log("\n🛡️  Audit");

  const r13 = run(`${pf}audit run`);
  assert("audit run succeeds", r13.ok);

  console.log("\n📖 Meta & Help");

  const r14 = run("meta schema");
  const metaSchema = parseJSON(r14.stdout);
  assert("meta schema returns valid JSON", metaSchema !== null);
  assert("meta schema has groups", metaSchema && Array.isArray(metaSchema.groups) && metaSchema.groups.length > 5);

  const r15 = run("meta exit-codes");
  assert("meta exit-codes succeeds", r15.ok);

  const r16 = run("meta common-options");
  assert("meta common-options succeeds", r16.ok);

  const r17 = run("meta patterns");
  assert("meta patterns succeeds", r17.ok);

  const r18 = run("help-ai list-groups");
  assert("help-ai list-groups succeeds", r18.ok);

  const r19 = run("help-ai group workflows");
  assert("help-ai group workflows succeeds", r19.ok);

  console.log("\n🧩 Node Catalog");

  // Sync catalog from instance
  const rSync = run(`${pf}nodes sync`);
  assert("nodes sync succeeds", rSync.ok);
  const syncResult = parseJSON(rSync.stdout);
  assert("sync returns node count", syncResult && typeof syncResult.nodeCount === "number" && syncResult.nodeCount > 0);
  assert("sync returns categories", syncResult && syncResult.categories && typeof syncResult.categories === "object");

  if (syncResult && syncResult.nodeCount > 0) {
    // List
    const rList = run(`${pf}nodes list --limit 5`);
    assert("nodes list succeeds", rList.ok);
    const nodeList = parseJSON(rList.stdout);
    assert("nodes list returns data", nodeList && Array.isArray(nodeList.data) && nodeList.data.length > 0);

    // List with category filter
    const rCatList = run(`${pf}nodes list --category trigger --limit 3`);
    assert("nodes list --category filter works", rCatList.ok);
    const catList = parseJSON(rCatList.stdout);
    if (catList?.data?.length > 0) {
      assert("category filter returns correct type", catList.data.every(n => n.category === "trigger"));
    }

    // Categories
    const rCats = run(`${pf}nodes categories`);
    assert("nodes categories succeeds", rCats.ok);
    const cats = parseJSON(rCats.stdout);
    assert("categories returns object", cats && cats.categories && typeof cats.categories === "object");

    // Search
    const rSearch = run(`${pf}nodes search "http request"`);
    assert("nodes search succeeds", rSearch.ok);
    const search = parseJSON(rSearch.stdout);
    assert("search returns results", search && Array.isArray(search.data));
    if (search?.data?.length > 0) {
      assert("search results have score", typeof search.data[0].score === "number");
      assert("search results have n8nType", typeof search.data[0].n8nType === "string");
    }

    // Get specific node
    const firstType = nodeList?.data?.[0]?.n8nType;
    if (firstType) {
      const rGet = run(`${pf}nodes get ${firstType}`);
      assert("nodes get succeeds", rGet.ok);
      const nodeDetail = parseJSON(rGet.stdout);
      assert("node detail has properties", nodeDetail && Array.isArray(nodeDetail.properties));
      assert("node detail has n8nType", nodeDetail && nodeDetail.n8nType === firstType);
    }

    // Get nonexistent node (error handling)
    const rGetBad = run(`${pf}nodes get fake.nonexistent.node`, { expectFail: true });
    assert("nodes get nonexistent returns error", rGetBad.ok);
  } else {
    skip("nodes list/search/get/categories", "sync returned 0 nodes");
  }

  console.log("\n🔍 Pagination (--all)");

  const rAll = run(`${pf}workflows list --all --fields id,name`);
  assert("--all pagination works", rAll.ok);
  const allWf = parseJSON(rAll.stdout);
  assert("--all returns data array", allWf && Array.isArray(allWf.data));

  console.log("\n❌ Error Handling");

  const rErr = run(`${pf}workflows get NONEXISTENT_ID_12345`, { expectFail: true });
  assert("invalid ID returns error", rErr.ok); // expectFail=true so ok means it did fail
  if (rErr.stderr) {
    const errJson = parseJSON(rErr.stderr.split("\n").filter(Boolean).pop());
    assert("error output is valid JSON", errJson !== null);
    assert("error has message field", errJson && errJson.message);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

console.log("🧪 n8n-cli Integration Tests");
console.log("═".repeat(50));

const allProfiles = args.includes("--all-profiles");
const profileArg = args.find((a, i) => args[i - 1] === "--profile");

if (allProfiles) {
  const r = run("profile list");
  const profiles = parseJSON(r.stdout);
  if (!profiles || !profiles.length) {
    console.error("No profiles found.");
    process.exit(1);
  }
  for (const p of profiles) {
    console.log(`\n${"═".repeat(50)}`);
    console.log(`🔄 Testing profile: ${p.name} (${p.baseUrl})`);
    console.log("═".repeat(50));
    testProfile(`--profile ${p.name}`);
  }
} else {
  const flag = profileArg ? `--profile ${profileArg}` : "";
  const label = profileArg || "default";
  console.log(`Profile: ${label}`);
  testProfile(flag);
}

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`📊 Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);

if (failures.length > 0) {
  console.log("\n🔴 Failures:");
  failures.forEach(f => console.log(f));
}

console.log("");
process.exit(failed > 0 ? 1 : 0);
