import assert from "node:assert/strict";
import { execFile as execFileCallback, spawn } from "node:child_process";
import { once } from "node:events";
import { createServer as createNetServer } from "node:net";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const execFile = promisify(execFileCallback);
const cli = (...args) => execFile(process.execPath, ["dist/cli.js", ...args], { maxBuffer: 2_000_000 });

await execFile("npm", ["run", "build"]);
await execFile(process.execPath, ["scripts/gen-tasks.mjs", "--seed", "43110", "--split", "hidden"]);
assert.equal((await readFile("data/tasks.hidden.jsonl", "utf8")).trim().split("\n").length, 36);
await unlink("data/tasks.hidden.jsonl");

const listed = JSON.parse((await cli("list", "--json")).stdout);
assert.equal(listed.tasks.length, 36);
const firstTask = listed.tasks[0];
assert.ok(firstTask);
const shown = JSON.parse((await cli("show", firstTask.id, "--json")).stdout);
assert.equal(shown.task.id, firstTask.id);

const runResult = await cli("run", "--provider", "mock", "--json");
const report = JSON.parse(runResult.stdout);
assert.equal(report.rows.length, 36);
assert.equal(report.mean, 21 / 36);
assert.equal(report.confidenceInterval95.low, 15 / 36);
assert.equal(report.confidenceInterval95.high, 26 / 36);
assert.ok(report.rows.some((row) => row.score === 1));
assert.ok(report.rows.some((row) => row.score === 0));
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/mock-report.json", `${JSON.stringify(report, null, 2)}\n`);
const rescored = JSON.parse((await cli("score", "artifacts/mock-report.json", "--json")).stdout);
assert.equal(rescored.rows.length, 36);
await cli("card", "artifacts/mock-report.json", "artifacts/share-card.svg", "--json");
assert.match(await readFile("artifacts/share-card.svg", "utf8"), /<svg/);
assert.match((await cli("provenance")).stdout, /Human-written skateboard trick glossary/);
const indexEntry = JSON.parse((await cli("index-entry", "--json")).stdout);
assert.equal(indexEntry.task_count, 36);
assert.equal(indexEntry.status, "alpha");
assert.equal(indexEntry.saturation, "unknown");

const { benchmark } = await import("../dist/index.js");
const tasks = await benchmark.listTasks();
const goodScores = await Promise.all(tasks.map((task) => benchmark.score(task, { answer: task.expected })));
assert.ok(goodScores.every(({ score }) => score === 1));
const badSubmissions = [
  { answer: "" },
  { answer: "random noise 4f943f" },
  { answer: "yes" },
  { toolLog: Array.from({ length: 3 }, (_, index) => ({ id: `same-${index}`, name: "finish_task", args: {}, result: {} })) },
];
const badScores = [];
for (const submission of badSubmissions) {
  const scores = await Promise.all(tasks.map((task) => benchmark.score(task, submission)));
  badScores.push(scores.reduce((sum, item) => sum + item.score, 0) / scores.length);
}
assert.ok(badScores.every((score) => score <= 0.1));
const expected = JSON.parse(firstTask.expected);
const signMiss = structuredClone(expected);
signMiss.rotations.long = signMiss.rotations.long === 0 ? 1 : -signMiss.rotations.long;
const signGrade = await benchmark.score(firstTask, { answer: JSON.stringify(signMiss) });
assert.ok(signGrade.score < 1 && signGrade.reason.includes("rotations.long"));
const toleranceMiss = structuredClone(expected);
toleranceMiss.airtimeS *= 1.051;
assert.ok((await benchmark.score(firstTask, { answer: JSON.stringify(toleranceMiss) })).score < 1);
const feasibilityMiss = structuredClone(expected);
feasibilityMiss.canFlipFinishInAir = !feasibilityMiss.canFlipFinishInAir;
assert.equal((await benchmark.score(firstTask, { answer: JSON.stringify(feasibilityMiss) })).score, 0.85);

const probe = createNetServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const address = probe.address(); assert.ok(address && typeof address === "object");
await new Promise((resolve) => probe.close(resolve));
const server = spawn(process.execPath, ["dist/cli.js", "serve", String(address.port)], { stdio: ["ignore", "pipe", "pipe"] });
const base = `http://127.0.0.1:${address.port}`; const routes = {};
async function get(path) {
  const response = await fetch(`${base}${path}`); routes[`GET ${path}`] = response.status;
  return { response, value: await response.json() };
}
try {
  for (let attempt = 0; attempt < 100; attempt++) { try { await get("/health"); break; } catch { await new Promise((resolve) => setTimeout(resolve, 20)); } }
  assert.equal((await get("/health")).response.status, 200);
  assert.equal((await get("/v1/tasks")).value.tasks.length, 36);
  assert.equal((await get(`/v1/tasks/${firstTask.id}`)).value.task.id, firstTask.id);
  const score = await fetch(`${base}/v1/score`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskId: firstTask.id, submission: { answer: firstTask.expected } }) });
  routes["POST /v1/score"] = score.status; assert.equal(score.status, 200); assert.equal((await score.json()).score, 1);
  assert.equal((await get("/v1/provenance")).response.status, 200);
  assert.equal((await get("/v1/index-entry")).value.task_count, 36);
} finally { if (server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); } }

const transport = new StdioClientTransport({ command: process.execPath, args: ["dist/cli.js", "mcp"], cwd: process.cwd(), stderr: "pipe" });
const client = new Client({ name: "benchmark-skateboard-e2e", version: "0.1.0" });
await client.connect(transport); let toolNames;
try {
  const available = await client.listTools(); toolNames = available.tools.map((tool) => tool.name).sort();
  assert.deepEqual(toolNames, ["get_provenance", "get_task", "list_tasks", "run_benchmark", "score_answer"]);
  const calls = [
    ["list_tasks", {}], ["get_task", { taskId: firstTask.id }],
    ["score_answer", { taskId: firstTask.id, submission: { answer: firstTask.expected } }],
    ["get_provenance", {}], ["run_benchmark", { model: "offline" }],
  ];
  for (const [name, args] of calls) {
    const result = await client.callTool({ name, arguments: args });
    if (name === "run_benchmark") assert.equal(result.isError, true); else assert.notEqual(result.isError, true);
  }
} finally { await client.close(); }

const artifact = { task_count: report.rows.length, scores: report.rows.map((row) => row.score), bad_answer_means: badScores, route_status_codes: routes, tool_names: toolNames };
await writeFile("artifacts/e2e-report.json", `${JSON.stringify(artifact, null, 2)}\n`);
const provenance = await readFile("data/PROVENANCE.md", "utf8");
assert.match(provenance, /36 public tasks use seed 20261015/);
console.log(`e2e: ${artifact.task_count} tasks, ${Object.keys(routes).length} routes, ${toolNames.length} tools, adversarial answers rejected -> all surfaces passed, ok`);
