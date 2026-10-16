import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  MAX_TOOL_LOG_ENTRIES,
  mockAdapter,
  openaiCompatAdapter,
  openrouterAdapter,
  run as runBenchmark,
  type Benchmark,
  type ModelAdapter,
  type Task,
  type Trace,
} from "benchmark-core";
import { benchmark, createBenchmark } from "./benchmark.js";
import { withSkateboardBreakdown } from "./report.js";
import { resolvePublicTasksPath } from "./tasks.js";

const tasksPathProperty = {
  type: "string",
  description: "Optional tasks JSONL path; must name a public split file under data/ in the package.",
};

const tools = [
  {
    name: "list_tasks",
    description: "List benchmark task ids and prompts.",
    inputSchema: { type: "object", properties: { tasksPath: tasksPathProperty }, additionalProperties: false },
  },
  {
    name: "get_task",
    description: "Get one benchmark task.",
    inputSchema: {
      type: "object",
      properties: { taskId: { type: "string" }, tasksPath: tasksPathProperty },
      required: ["taskId"],
      additionalProperties: false,
    },
  },
  {
    name: "score_answer",
    description: "Score a trace with the deterministic benchmark grader.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        submission: { type: "object" },
        seed: { type: "number" },
        tasksPath: tasksPathProperty,
      },
      required: ["taskId", "submission"],
      additionalProperties: false,
    },
  },
  {
    name: "run_benchmark",
    description: "Run every task through a model and return the report with field breakdown.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        provider: { type: "string", enum: ["openrouter", "openai", "mock"] },
        seed: { type: "number" },
        tasksPath: tasksPathProperty,
      },
      required: ["model"],
      additionalProperties: false,
    },
  },
  {
    name: "get_provenance",
    description: "Get benchmark data provenance.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

const content = (value: unknown, isError = false) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
  ...(isError ? { isError: true } : {}),
});

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

function pickBenchmark(
  input: Record<string, unknown>,
  base: Benchmark<Task>,
): { instance: Benchmark<Task> } | { error: string } {
  if (input.tasksPath === undefined) return { instance: base };
  if (typeof input.tasksPath !== "string") return { error: "tasksPath must be a string." };
  const resolved = resolvePublicTasksPath(input.tasksPath);
  if (resolved === undefined) return { error: "tasksPath must name a *.jsonl split file under data/." };
  return { instance: createBenchmark(resolved) as Benchmark<Task> };
}

function pickAdapter(input: Record<string, unknown>): { adapter: ModelAdapter } | { error: string } {
  if (typeof input.model !== "string") return { error: "model is required." };
  const provider = input.provider ?? "openrouter";
  const seed = typeof input.seed === "number" ? input.seed : 1;
  if (provider === "mock") return { adapter: mockAdapter({ seed }) };
  if (provider === "openai") return { adapter: openaiCompatAdapter({ model: input.model }) };
  if (provider === "openrouter") {
    if (!process.env.OPENROUTER_API_KEY) return { error: "OPENROUTER_API_KEY is required to run a benchmark." };
    return { adapter: openrouterAdapter({ model: input.model }) };
  }
  return { error: "provider must be openrouter, openai, or mock." };
}

export function createMcpServer(options?: { tasksPath?: string }): Server {
  const base = options?.tasksPath === undefined ? benchmark : createBenchmark(options.tasksPath);
  const server = new Server(
    { name: base.definition.id, version: base.definition.version },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const input = asRecord(request.params.arguments);
      const picked = pickBenchmark(input, base as Benchmark<Task>);
      if ("error" in picked) return content({ error: picked.error }, true);
      const instance = picked.instance;
      if (request.params.name === "list_tasks") return content({ tasks: await instance.listTasks() });
      if (request.params.name === "get_task") {
        if (typeof input.taskId !== "string") return content({ error: "taskId is required." }, true);
        const task = await instance.getTask(input.taskId);
        return task ? content({ task }) : content({ error: "Task not found." }, true);
      }
      if (request.params.name === "score_answer") {
        if (
          typeof input.taskId !== "string" ||
          !input.submission ||
          typeof input.submission !== "object" ||
          Array.isArray(input.submission)
        )
          return content({ error: "taskId and submission are required." }, true);
        const submittedLog = Reflect.get(input.submission, "toolLog");
        if (Array.isArray(submittedLog) && submittedLog.length > MAX_TOOL_LOG_ENTRIES)
          return content({ error: `toolLog may not exceed ${MAX_TOOL_LOG_ENTRIES} entries.` }, true);
        const task = await instance.getTask(input.taskId);
        return task
          ? content({
              taskId: task.id,
              ...(await instance.score(
                task,
                input.submission as unknown as Trace,
                typeof input.seed === "number" ? { seed: input.seed } : {},
              )),
            })
          : content({ error: "Task not found." }, true);
      }
      if (request.params.name === "run_benchmark") {
        const chosen = pickAdapter(input);
        if ("error" in chosen) return content({ error: chosen.error }, true);
        const report = await runBenchmark(instance, chosen.adapter, {
          seed: typeof input.seed === "number" ? input.seed : 1,
        });
        return content(withSkateboardBreakdown(report, await instance.listTasks()));
      }
      if (request.params.name === "get_provenance") return content({ provenance: instance.definition.provenance });
      return content({ error: `Unknown tool: ${request.params.name}` }, true);
    } catch (caught) {
      return content({ error: caught instanceof Error ? caught.message : "Unknown error." }, true);
    }
  });
  return server;
}

export async function startMcp(options?: { tasksPath?: string }): Promise<void> {
  await createMcpServer(options).connect(new StdioServerTransport());
}
