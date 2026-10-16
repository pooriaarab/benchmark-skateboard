import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Task } from "benchmark-core";

const defaultTasksPath = fileURLToPath(new URL("../data/tasks.jsonl", import.meta.url));
const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const publicSplitsDir = resolve(packageRoot, "data");

/** Resolve a client-supplied tasks path; only paths inside the package are allowed. */
export function resolvePackagedTasksPath(path: string): string | undefined {
  if (path.length === 0 || path.includes("\0")) return undefined;
  const resolved = resolve(packageRoot, path);
  return resolved.startsWith(packageRoot + sep) ? resolved : undefined;
}

/** Resolve a remote-supplied tasks path; only public `*.jsonl` split files under `data/` are allowed. */
export function resolvePublicTasksPath(path: string): string | undefined {
  const resolved = resolvePackagedTasksPath(path);
  if (resolved === undefined || !resolved.endsWith(".jsonl")) return undefined;
  return resolved.startsWith(publicSplitsDir + sep) ? resolved : undefined;
}

/** Read a tasks JSONL file; defaults to the packaged public split. */
export async function loadTasksFile(filePath?: string): Promise<Task[]> {
  const resolved = resolve(filePath ?? defaultTasksPath);
  const text = await readFile(resolved, "utf8");
  return text
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Task);
}
