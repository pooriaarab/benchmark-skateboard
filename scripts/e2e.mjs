import assert from "node:assert/strict";
import { execFile as execFileCallback, spawn } from "node:child_process";
import { once } from "node:events";
import { createServer as createNetServer } from "node:net";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mockAdapter } from "benchmark-core";
const execFile = promisify(execFileCallback);
const cli = (...args) => execFile(process.execPath, ["dist/cli.js", ...args], { maxBuffer: 2_000_000 });

const hiddenSeed = 88200416;
const hiddenPath = ".hidden/tasks.jsonl";
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const round3 = (value) => Math.round(value * 1000) / 1000;

await execFile("npm", ["run", "build"]);
await execFile(process.execPath, ["scripts/gen-tasks.mjs", "--seed", String(hiddenSeed), "--split", "hidden"]);
const hiddenTasks = (await readFile(hiddenPath, "utf8"))
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));

const packList = JSON.parse((await execFile("npm", ["pack", "--dry-run", "--json"])).stdout);
assert.ok(packList[0].files.every((file) => !file.path.startsWith(".hidden") && !file.path.startsWith("artifacts")));

const listed = JSON.parse((await cli("list", "--json")).stdout);
const taskCount = listed.tasks.length;
assert.equal(taskCount, 72);
assert.equal(hiddenTasks.length, taskCount);
const firstTask = listed.tasks[0];
assert.ok(firstTask);
const shown = JSON.parse((await cli("show", firstTask.id, "--json")).stdout);
assert.equal(shown.task.id, firstTask.id);

const runResult = await cli("run", "--provider", "mock", "--json");
const report = JSON.parse(runResult.stdout);
assert.equal(report.rows.length, taskCount);
assert.ok(report.breakdown);
assert.ok(typeof report.breakdown.rotations === "number");
assert.ok(report.mean > 0 && report.mean < 1);
assert.ok(report.rows.some((row) => row.score === 1));
assert.ok(report.rows.some((row) => row.score === 0));
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/mock-report.json", `${JSON.stringify(report, null, 2)}\n`);
const rescored = JSON.parse((await cli("score", "artifacts/mock-report.json", "--json")).stdout);
assert.equal(rescored.rows.length, taskCount);
assert.ok(rescored.breakdown);
await cli("card", "artifacts/mock-report.json", "artifacts/share-card.svg", "--json");
assert.match(await readFile("artifacts/share-card.svg", "utf8"), /<svg/);
assert.match((await cli("provenance")).stdout, /Human-written skateboard trick glossary/);
const indexEntry = JSON.parse((await cli("index-entry", "--json")).stdout);
assert.equal(indexEntry.task_count, taskCount);
assert.equal(indexEntry.status, "alpha");

const { benchmark, run } = await import("../dist/index.js");
const tasks = await benchmark.listTasks();
const goodScores = await Promise.all(tasks.map((task) => benchmark.score(task, { answer: task.expected })));
assert.ok(goodScores.every(({ score }) => score === 1));

const readmeConstant =
  '{"rotations":{"long":1,"vertical":0,"cross":0},"airtimeS":0.571,"peakHeightM":0.4,"landsWheelsDown":true,"canFlipFinishInAir":true}';
const badSubmissions = [
  { answer: "" },
  { answer: "random noise 4f943f" },
  { answer: "yes" },
  { answer: "I cannot provide that answer." },
  {
    answer:
      '{"rotations":{"long":0,"vertical":0,"cross":0},"airtimeS":0,"peakHeightM":0,"landsWheelsDown":true,"canFlipFinishInAir":true}',
  },
  { answer: readmeConstant },
  {
    toolLog: Array.from({ length: 3 }, (_, index) => ({
      id: `same-${index}`,
      name: "finish_task",
      args: {},
      result: {},
    })),
  },
];
const badScores = [];
for (const submission of badSubmissions) {
  const scores = await Promise.all(tasks.map((task) => benchmark.score(task, submission)));
  badScores.push(mean(scores.map((item) => item.score)));
}
assert.ok(badScores.every((score) => score <= 0.2));

// Both booleans come out false on about half the tasks in each split.
for (const split of [tasks, hiddenTasks]) {
  const exps = split.map((task) => JSON.parse(task.expected));
  const landsTrue = exps.filter((exp) => exp.landsWheelsDown).length;
  const flipTrue = exps.filter((exp) => exp.canFlipFinishInAir).length;
  assert.ok(landsTrue >= 28 && landsTrue <= 44, `landsWheelsDown true ${landsTrue}/${split.length}`);
  assert.ok(flipTrue >= 28 && flipTrue <= 44, `canFlipFinishInAir true ${flipTrue}/${split.length}`);
}

const fenced = await benchmark.score(firstTask, {
  answer: `Here is the result:\n\`\`\`json\n${firstTask.expected}\n\`\`\``,
});
assert.equal(fenced.score, 1);
const bareThenProse = await benchmark.score(firstTask, {
  answer: `${firstTask.expected}\nThat is the result.`,
});
assert.equal(bareThenProse.score, 1);
const earlierDecoy = await benchmark.score(firstTask, {
  answer: `notes {"junk":true}\n${firstTask.expected}`,
});
assert.equal(earlierDecoy.score, 1);
const strayBrace = await benchmark.score(firstTask, {
  answer: `open { then ${firstTask.expected}`,
});
assert.equal(strayBrace.score, 1);

const expected = JSON.parse(firstTask.expected);
const signMiss = structuredClone(expected);
signMiss.rotations.long = signMiss.rotations.long === 0 ? 1 : -signMiss.rotations.long;
const signGrade = await benchmark.score(firstTask, { answer: JSON.stringify(signMiss) });
assert.ok(signGrade.score < 1 && signGrade.reason.includes("rotations"));
const toleranceMiss = structuredClone(expected);
toleranceMiss.airtimeS *= 1.051;
assert.ok((await benchmark.score(firstTask, { answer: JSON.stringify(toleranceMiss) })).score < 1);
const feasibilityMiss = structuredClone(expected);
feasibilityMiss.canFlipFinishInAir = !feasibilityMiss.canFlipFinishInAir;
assert.equal((await benchmark.score(firstTask, { answer: JSON.stringify(feasibilityMiss) })).score, 0.81);

// Adversarial arithmetic strategies over every task, on public and hidden splits.
const probe = { wrongFormula: [], tableOnly: [], airtime99: [] };
for (const task of [...tasks, ...hiddenTasks]) {
  const exp = JSON.parse(task.expected);
  const meta = task.metadata;
  const variants = {
    wrongFormula: {
      rotations: exp.rotations,
      airtimeS: round3(meta.launchSpeed / meta.gravity),
      peakHeightM: round3(meta.launchSpeed ** 2 / meta.gravity),
      landsWheelsDown: exp.landsWheelsDown,
      canFlipFinishInAir: exp.canFlipFinishInAir,
    },
    tableOnly: {
      rotations: exp.rotations,
      airtimeS: round3(exp.airtimeS * 1.3),
      peakHeightM: round3(exp.peakHeightM * 1.3),
      landsWheelsDown: exp.landsWheelsDown,
      canFlipFinishInAir: exp.canFlipFinishInAir,
    },
    airtime99: {
      rotations: exp.rotations,
      airtimeS: 99,
      peakHeightM: exp.peakHeightM,
      landsWheelsDown: true,
      canFlipFinishInAir: true,
    },
  };
  for (const [name, answer] of Object.entries(variants)) {
    probe[name].push((await benchmark.score(task, { answer: JSON.stringify(answer) })).score);
  }
}
assert.ok(Math.max(...probe.wrongFormula) < 0.3, `wrong-formula max ${Math.max(...probe.wrongFormula)}`);
assert.ok(Math.max(...probe.tableOnly) < 0.3, `table-lookup max ${Math.max(...probe.tableOnly)}`);

// A run with a tasks path must not reuse the task list of an earlier run.
const runIds = (rows) => [...new Set(rows.map((row) => row.taskId.split("-")[0]))];
for (const expectedIds of [["public"], ["hidden"], ["public"], ["hidden"]]) {
  const options = expectedIds[0] === "hidden" ? { tasks: hiddenPath } : {};
  const outcome = await run(mockAdapter({ seed: 5 }), options);
  assert.deepEqual(runIds(outcome.rows), expectedIds);
}

// Visible-information policy: solve every task from the prompt text alone.
const glossary = JSON.parse(await readFile("data/tricks.json", "utf8"));
const byName = new Map(glossary.tricks.map((trick) => [trick.name.toLowerCase(), trick]));
const visiblePolicy = {
  id: "visible:prompt-only",
  async complete(prompt) {
    const trick = byName.get(prompt.match(/attempts an? (.*?) on (?:Earth|the Moon|Mars)\./)[1]);
    const gravity = Number(prompt.match(/Use gravity ([\d.]+) m\/s/)[1]);
    const launchSpeed = Number(prompt.match(/upward launch speed ([\d.]+) m\/s/)[1]);
    const minimum = Number(prompt.match(/needs at least ([\d.]+) s/)[1]);
    const airtimeS = round3((2 * launchSpeed) / gravity);
    const answer = {
      rotations: trick.rotations,
      airtimeS,
      peakHeightM: round3(launchSpeed ** 2 / (2 * gravity)),
      landsWheelsDown: Number.isInteger(trick.rotations.long) && Number.isInteger(trick.rotations.cross),
      canFlipFinishInAir: airtimeS + 1e-9 >= minimum,
    };
    return { content: JSON.stringify(answer) };
  },
  async chat() {
    throw new Error("single-answer tasks do not use chat");
  },
};
const visibleReport = await run(visiblePolicy, {});
const solved = visibleReport.rows.filter((row) => row.score === 1).length;
assert.equal(solved, taskCount);

const publicByTrickWorld = new Map(tasks.map((task) => [`${task.metadata.trick}:${task.metadata.world}`, task]));
let promptMatches = 0;
for (const hidden of hiddenTasks) {
  const publicTask = publicByTrickWorld.get(`${hidden.metadata.trick}:${hidden.metadata.world}`);
  if (publicTask && publicTask.prompt === hidden.prompt) promptMatches += 1;
}
assert.ok(promptMatches < hiddenTasks.length / 2);
const publicOnHidden = await Promise.all(
  hiddenTasks.map((hidden) => {
    const publicTask = publicByTrickWorld.get(`${hidden.metadata.trick}:${hidden.metadata.world}`);
    return publicTask ? benchmark.score(hidden, { answer: publicTask.expected }) : { score: 0 };
  }),
);
const publicOnHiddenMean = mean(publicOnHidden.map((item) => item.score));
assert.ok(publicOnHiddenMean < 1);
assert.ok(publicOnHiddenMean <= 0.3);

const altListed = JSON.parse((await cli("list", "--tasks", hiddenPath, "--json")).stdout);
assert.equal(altListed.tasks.length, taskCount);
assert.ok(altListed.tasks.every((task) => task.id.startsWith("hidden-")));
const altRun = JSON.parse((await cli("run", "--provider", "mock", "--tasks", hiddenPath, "--json")).stdout);
assert.ok(altRun.rows.every((row) => row.taskId.startsWith("hidden-")));

const probeNet = createNetServer();
await new Promise((resolve) => probeNet.listen(0, "127.0.0.1", resolve));
const address = probeNet.address();
assert.ok(address && typeof address === "object");
await new Promise((resolve) => probeNet.close(resolve));
const server = spawn(process.execPath, ["dist/cli.js", "serve", String(address.port)], {
  stdio: ["ignore", "pipe", "pipe"],
});
const base = `http://127.0.0.1:${address.port}`;
const routes = {};
async function get(path) {
  const response = await fetch(`${base}${path}`);
  routes[`GET ${path}`] = response.status;
  return { response, value: await response.json() };
}
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await get("/health");
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  assert.equal((await get("/health")).response.status, 200);
  assert.equal((await get("/v1/tasks")).value.tasks.length, taskCount);
  assert.equal((await get(`/v1/tasks/${firstTask.id}`)).value.task.id, firstTask.id);
  const score = await fetch(`${base}/v1/score`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ taskId: firstTask.id, submission: { answer: firstTask.expected } }),
  });
  routes["POST /v1/score"] = score.status;
  assert.equal(score.status, 200);
  assert.equal((await score.json()).score, 1);
  assert.equal((await get("/v1/provenance")).response.status, 200);
  assert.equal((await get("/v1/index-entry")).value.task_count, taskCount);
  const hiddenListed = await get(`/v1/tasks?tasks=${encodeURIComponent(hiddenPath)}`);
  assert.ok(hiddenListed.value.tasks.every((task) => task.id.startsWith("hidden-")));
  const hiddenScore = await fetch(`${base}/v1/score?tasks=${encodeURIComponent(hiddenPath)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ taskId: hiddenTasks[0].id, submission: { answer: hiddenTasks[0].expected } }),
  });
  routes["POST /v1/score?tasks=hidden"] = hiddenScore.status;
  assert.equal(hiddenScore.status, 200);
  assert.equal((await hiddenScore.json()).score, 1);
  assert.equal((await get("/v1/tasks?tasks=../../etc/passwd")).response.status, 400);
} finally {
  if (server.exitCode === null) {
    server.kill("SIGTERM");
    await once(server, "exit");
  }
}

// A `serve --tasks` launch keeps the split for every later request.
const probeNet2 = createNetServer();
await new Promise((resolve) => probeNet2.listen(0, "127.0.0.1", resolve));
const address2 = probeNet2.address();
assert.ok(address2 && typeof address2 === "object");
await new Promise((resolve) => probeNet2.close(resolve));
const hiddenServer = spawn(
  process.execPath,
  ["dist/cli.js", "serve", String(address2.port), "--tasks", hiddenPath],
  { stdio: ["ignore", "pipe", "pipe"] },
);
try {
  let served;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      served = await fetch(`http://127.0.0.1:${address2.port}/v1/tasks`);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  const value = await served.json();
  routes["GET /v1/tasks (serve --tasks)"] = served.status;
  assert.ok(value.tasks.every((task) => task.id.startsWith("hidden-")));
} finally {
  if (hiddenServer.exitCode === null) {
    hiddenServer.kill("SIGTERM");
    await once(hiddenServer, "exit");
  }
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/cli.js", "mcp"],
  cwd: process.cwd(),
  stderr: "pipe",
});
const client = new Client({ name: "benchmark-skateboard-e2e", version: "0.1.0" });
await client.connect(transport);
let toolNames;
try {
  const available = await client.listTools();
  toolNames = available.tools.map((tool) => tool.name).sort();
  assert.deepEqual(toolNames, ["get_provenance", "get_task", "list_tasks", "run_benchmark", "score_answer"]);
  const calls = [
    ["list_tasks", {}],
    ["get_task", { taskId: firstTask.id }],
    ["score_answer", { taskId: firstTask.id, submission: { answer: firstTask.expected } }],
    ["get_provenance", {}],
    ["list_tasks", { tasksPath: hiddenPath }],
    ["run_benchmark", { model: "offline" }],
  ];
  for (const [name, args] of calls) {
    const result = await client.callTool({ name, arguments: args });
    if (name === "run_benchmark") assert.equal(result.isError, true);
    else if (name === "list_tasks" && args.tasksPath)
      assert.ok(JSON.parse(result.content[0].text).tasks.every((task) => task.id.startsWith("hidden-")));
    else assert.notEqual(result.isError, true);
  }
  const mcpRun = await client.callTool({
    name: "run_benchmark",
    arguments: { model: "offline", provider: "mock", tasksPath: hiddenPath },
  });
  assert.notEqual(mcpRun.isError, true);
  const mcpReport = JSON.parse(mcpRun.content[0].text);
  assert.ok(mcpReport.breakdown && typeof mcpReport.breakdown.rotations === "number");
  assert.ok(mcpReport.rows.every((row) => row.taskId.startsWith("hidden-")));
} finally {
  await client.close();
}

await unlink(hiddenPath);

const artifact = {
  task_count: report.rows.length,
  scores: report.rows.map((row) => row.score),
  bad_answer_means: badScores,
  probe_means: Object.fromEntries(Object.entries(probe).map(([name, values]) => [name, mean(values)])),
  visible_solved: `${solved}/${taskCount}`,
  route_status_codes: routes,
  tool_names: toolNames,
};
await writeFile("artifacts/e2e-report.json", `${JSON.stringify(artifact, null, 2)}\n`);
const provenance = await readFile("data/PROVENANCE.md", "utf8");
assert.match(provenance, /72 public tasks use seed 20261015/);
console.log(
  `e2e: ${artifact.task_count} tasks, ${Object.keys(routes).length} routes, ${toolNames.length} tools, ` +
    `visible policy solved ${artifact.visible_solved}, adversarial answers rejected -> all surfaces passed, ok`,
);
