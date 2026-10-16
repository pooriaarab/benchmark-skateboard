import type { RunReport, Trace, Task } from "benchmark-core";
import { skateboardFieldScores } from "./grading.js";

export type SkateboardBreakdown = {
  rotations: number;
  physics: number;
  landing: number;
};

export type SkateboardRunReport = RunReport & { breakdown: SkateboardBreakdown };

export function aggregateBreakdown(
  tasks: readonly Task[],
  rows: RunReport["rows"],
): SkateboardBreakdown {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  let rotations = 0;
  let physics = 0;
  let landing = 0;
  let count = 0;
  for (const row of rows) {
    const task = byId.get(row.taskId);
    const submission = row.submission as Trace | undefined;
    if (!task || !submission) continue;
    const parts = skateboardFieldScores(task, submission);
    rotations += parts?.rotations ?? 0;
    physics += parts?.physics ?? 0;
    landing += parts?.landing ?? 0;
    count += 1;
  }
  if (count === 0) return { rotations: 0, physics: 0, landing: 0 };
  return {
    rotations: Math.round((rotations / count) * 1000) / 1000,
    physics: Math.round((physics / count) * 1000) / 1000,
    landing: Math.round((landing / count) * 1000) / 1000,
  };
}

export function withSkateboardBreakdown(report: RunReport, tasks: readonly Task[]): SkateboardRunReport {
  return { ...report, breakdown: aggregateBreakdown(tasks, report.rows) };
}

export function formatBreakdownLine(breakdown: SkateboardBreakdown): string {
  const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
  return `Breakdown — rotations: ${pct(breakdown.rotations)}, physics: ${pct(breakdown.physics)}, landing: ${pct(breakdown.landing)}`;
}
