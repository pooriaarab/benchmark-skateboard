import { existsSync } from "node:fs";
import { createHandler, type Benchmark, type Task } from "benchmark-core";
import { benchmark, createBenchmark } from "./benchmark.js";
import { resolvePackagedTasksPath } from "./tasks.js";

type Handler = (request: Request) => Promise<Response>;

function tasksError(): Response {
  return Response.json(
    { error: { code: "INVALID_TASKS_PATH", message: "tasks must resolve inside the package." } },
    { status: 400 },
  );
}

/** Fetch-style handler; `?tasks=<path>` runs a split file inside the package. */
export function createSkateboardHandler(base: Benchmark<Task> = benchmark as Benchmark<Task>): Handler {
  const baseHandler = createHandler(base);
  const byPath = new Map<string, Handler>();
  return (request) => {
    const param = new URL(request.url).searchParams.get("tasks");
    if (param === null) return baseHandler(request);
    const resolved = resolvePackagedTasksPath(param);
    if (resolved === undefined) return Promise.resolve(tasksError());
    let handler = byPath.get(resolved);
    if (!handler) {
      handler = createHandler(createBenchmark(resolved) as Benchmark<Task>);
      if (existsSync(resolved)) byPath.set(resolved, handler);
    }
    return handler(request);
  };
}

export const handler = createSkateboardHandler();
