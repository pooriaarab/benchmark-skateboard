import { createHandler } from "benchmark-core";
import { benchmark } from "./benchmark.js";
import { setTasksPath } from "./tasks.js";

const coreHandler = createHandler(benchmark);

export const handler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const tasksParam = url.searchParams.get("tasks");
  if (tasksParam) setTasksPath(tasksParam);
  return coreHandler(request);
};
