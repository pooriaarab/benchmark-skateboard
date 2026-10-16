#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  bootstrapCI,
  createCli,
  mockAdapter,
  openaiCompatAdapter,
  openrouterAdapter,
  renderMarkdown,
  run as runBenchmark,
  serve,
} from "benchmark-core";
import { createBenchmark } from "./benchmark.js";
import { createSkateboardHandler } from "./api.js";
import { startMcp } from "./mcp.js";
import { formatBreakdownLine, withSkateboardBreakdown } from "./report.js";

function extractTasksFlag(argv: string[]): { args: string[]; tasksPath?: string } {
  const next: string[] = [];
  let tasksPath: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--tasks") {
      const path = argv[index + 1];
      if (typeof path !== "string" || path.length === 0) throw new Error("--tasks needs a path.");
      tasksPath = path;
      index += 1;
      continue;
    }
    const item = argv[index];
    if (item !== undefined) next.push(item);
  }
  return tasksPath === undefined ? { args: next } : { args: next, tasksPath };
}

function adapter(provider: string, model: string, seed: number) {
  if (provider === "mock") return mockAdapter({ seed });
  if (provider === "openrouter") return openrouterAdapter({ model });
  if (provider === "openai") return openaiCompatAdapter({ model });
  throw new Error("--provider must be openrouter, openai, or mock.");
}

const { args, tasksPath } = extractTasksFlag(process.argv.slice(2));
const benchmark = createBenchmark(tasksPath);
const core = createCli(benchmark, { bin: "benchmark-skateboard" });

async function runCommand(argv: string[]): Promise<number> {
  const jsonOutput = argv.includes("--json");
  const clean = argv.filter((arg) => arg !== "--json");
  const parsed = parseArgs({
    args: clean,
    options: {
      model: { type: "string" },
      provider: { type: "string" },
      concurrency: { type: "string" },
      timeout: { type: "string" },
      retries: { type: "string" },
      seed: { type: "string" },
      "max-turns": { type: "string" },
      "max-tool-calls": { type: "string" },
      budget: { type: "string" },
    },
    strict: true,
  });
  const model = parsed.values.model;
  const provider = parsed.values.provider;
  if (!model || !provider) throw new Error("run needs --model and --provider.");
  const seed = Number(parsed.values.seed ?? 1);
  const report = await runBenchmark(benchmark, adapter(provider, model, seed), {
    seed,
    ...(parsed.values.concurrency ? { concurrency: Number(parsed.values.concurrency) } : {}),
    ...(parsed.values.timeout ? { timeoutMs: Number(parsed.values.timeout) } : {}),
    ...(parsed.values.retries ? { retries: Number(parsed.values.retries) } : {}),
    ...(parsed.values["max-turns"] ? { maxTurns: Number(parsed.values["max-turns"]) } : {}),
    ...(parsed.values["max-tool-calls"] ? { maxToolCalls: Number(parsed.values["max-tool-calls"]) } : {}),
    ...(parsed.values.budget ? { budgetUsd: Number(parsed.values.budget) } : {}),
  });
  const tasks = await benchmark.listTasks();
  const enriched = withSkateboardBreakdown(report, tasks);
  const breakdownLine = formatBreakdownLine(enriched.breakdown);
  if (jsonOutput) {
    console.log(JSON.stringify(enriched));
  } else {
    console.log(`${renderMarkdown(report)}\n${breakdownLine}\n`);
  }
  return report.rows.some((row) => row.error) ? 2 : 0;
}

async function scoreCommand(argv: string[]): Promise<number> {
  const jsonOutput = argv.includes("--json");
  const clean = argv.filter((arg) => arg !== "--json");
  const file = clean[0];
  if (!file) throw new Error("score needs a results JSON file.");
  const original = JSON.parse(await readFile(file, "utf8"));
  if (!original || typeof original !== "object" || !Array.isArray(original.rows)) {
    throw new Error("File is not a run report.");
  }
  const rows = [];
  for (const row of original.rows) {
    const task = await benchmark.getTask(row.taskId);
    if (!task || row.submission === undefined) throw new Error(`Cannot score task ${row.taskId}.`);
    const grade = await benchmark.score(task, row.submission, { seed: original.seed });
    rows.push({ ...row, score: grade.score, reason: grade.reason });
  }
  const scores = rows.map((row) => row.score);
  const rescored = {
    ...original,
    rows,
    mean: scores.reduce((a, b) => a + b, 0) / scores.length,
    confidenceInterval95: bootstrapCI(scores, original.seed),
  };
  const tasks = await benchmark.listTasks();
  const enriched = withSkateboardBreakdown(rescored, tasks);
  const breakdownLine = formatBreakdownLine(enriched.breakdown);
  if (jsonOutput) {
    console.log(JSON.stringify(enriched));
  } else {
    console.log(`${renderMarkdown(rescored)}\n${breakdownLine}\n`);
  }
  return 0;
}

async function serveCommand(argv: string[]): Promise<number> {
  const parsed = parseArgs({
    args: argv.filter((arg) => arg !== "--json"),
    options: { host: { type: "string" } },
    allowPositionals: true,
    strict: true,
  });
  if (parsed.positionals.length > 1) throw new Error("serve accepts at most one port.");
  const port = Number(parsed.positionals[0] ?? process.env.PORT ?? 3000);
  const hostname = parsed.values.host ?? "127.0.0.1";
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("serve port must be an integer from 0 to 65535.");
  if (!hostname.trim()) throw new Error("--host must not be empty.");
  await serve(createSkateboardHandler(benchmark), { port, hostname });
  console.log(`Listening on http://${hostname}:${port}`);
  return 0;
}

if (args[0] === "run" && args.includes("--provider") && args[args.indexOf("--provider") + 1] === "mock" && !args.includes("--model")) {
  args.push("--model", "offline");
}

try {
  if (args[0] === "run") process.exitCode = await runCommand(args.slice(1));
  else if (args[0] === "score") process.exitCode = await scoreCommand(args.slice(1));
  else if (args[0] === "serve") process.exitCode = await serveCommand(args.slice(1));
  else if (args[0] === "mcp") await startMcp(tasksPath === undefined ? undefined : { tasksPath });
  else process.exitCode = await core.main(args);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
