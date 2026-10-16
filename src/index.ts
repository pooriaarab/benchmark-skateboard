import {
  run as runBenchmark,
  type ModelAdapter,
  type RunOptions,
  type Trace,
} from "benchmark-core";
import { benchmark } from "./benchmark.js";
import { withSkateboardBreakdown, type SkateboardRunReport } from "./report.js";
import { withTasksPath } from "./tasks.js";

export { benchmark };
export type { SkateboardRunReport } from "./report.js";
export { setTasksPath, getTasksPath, loadTasksFile, withTasksPath } from "./tasks.js";
export { parseAnswer, gradeSkateboard } from "./grading.js";

export type SkateboardRunOptions = RunOptions & { tasks?: string };

export const run = async (
  adapter: ModelAdapter,
  options?: SkateboardRunOptions,
): Promise<SkateboardRunReport> => {
  const { tasks: tasksFile, ...runOptions } = options ?? {};
  return withTasksPath(tasksFile, async () => {
    const report = await runBenchmark(benchmark, adapter, runOptions);
    const tasks = await benchmark.listTasks();
    return withSkateboardBreakdown(report, tasks);
  });
};

export async function score(taskId: string, submission: Trace) {
  const task = await benchmark.getTask(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  return benchmark.score(task, submission);
}
