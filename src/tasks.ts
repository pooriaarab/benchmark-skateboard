import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Task } from "benchmark-core";

const defaultTasksPath = fileURLToPath(new URL("../data/tasks.jsonl", import.meta.url));
const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

let tasksPath: string | undefined = process.env.BENCHMARK_SKATEBOARD_TASKS;
let cached: Promise<Task[]> | undefined;

export function setTasksPath(path: string | undefined): void {
  tasksPath = path;
  cached = undefined;
}

export function getTasksPath(): string | undefined {
  return tasksPath;
}

/** Resolve a client-supplied tasks path; only paths inside the package are allowed. */
export function resolvePackagedTasksPath(path: string): string | undefined {
  if (path.length === 0 || path.includes("\0")) return undefined;
  const resolved = resolve(packageRoot, path);
  return resolved.startsWith(packageRoot + sep) ? resolved : undefined;
}

export async function loadTasksFile(filePath?: string): Promise<Task[]> {
  const resolved = resolve(filePath ?? tasksPath ?? defaultTasksPath);
  const text = await readFile(resolved, "utf8");
  return text
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Task);
}

export function loadTasks(): Promise<Task[]> {
  cached ??= loadTasksFile();
  return cached;
}

export async function withTasksPath<T>(path: string | undefined, fn: () => Promise<T>): Promise<T> {
  const previous = tasksPath;
  if (path !== undefined) {
    tasksPath = path;
    cached = undefined;
  }
  try {
    return await fn();
  } finally {
    tasksPath = previous;
    cached = undefined;
  }
}
