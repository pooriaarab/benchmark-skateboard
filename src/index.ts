import {
  run as runBenchmark,
  type ModelAdapter,
  type RunOptions,
  type Trace,
} from "benchmark-core";
import { benchmark, createBenchmark } from "./benchmark.js";
import { withSkateboardBreakdown, type SkateboardRunReport } from "./report.js";

export { benchmark, createBenchmark };
export type { SkateboardRunReport } from "./report.js";
export { setTasksPath, getTasksPath, loadTasksFile, withTasksPath, resolvePackagedTasksPath, resolvePublicTasksPath } from "./tasks.js";
export { parseAnswer, gradeSkateboard } from "./grading.js";

export type SkateboardRunOptions = RunOptions & { tasks?: string };

export const run = async (
  adapter: ModelAdapter,
  options?: SkateboardRunOptions,
): Promise<SkateboardRunReport> => {
  const { tasks: tasksFile, ...runOptions } = options ?? {};
  const instance = createBenchmark(tasksFile);
  const report = await runBenchmark(instance, adapter, runOptions);
  return withSkateboardBreakdown(report, await instance.listTasks());
};

export async function score(taskId: string, submission: Trace, options?: { tasks?: string }) {
  const instance = options?.tasks === undefined ? benchmark : createBenchmark(options.tasks);
  const task = await instance.getTask(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  return instance.score(task, submission);
}
