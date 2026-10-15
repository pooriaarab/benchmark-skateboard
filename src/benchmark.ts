import { readFile } from "node:fs/promises";
import { defineBenchmark, type Task, type TaskScore, type Trace } from "benchmark-core";

type Answer = {
  rotations: { long: number; vertical: number; cross: number };
  airtimeS: number;
  peakHeightM: number;
  landsWheelsDown: boolean;
  canFlipFinishInAir: boolean;
};

async function loadTasks(): Promise<Task[]> {
  const text = await readFile(new URL("../data/tasks.jsonl", import.meta.url), "utf8");
  return text.trim().split("\n").map((line) => JSON.parse(line) as Task);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const hasOnly = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => key in value);

function parseAnswer(value: unknown): Answer | undefined {
  if (typeof value !== "string") return undefined;
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { return undefined; }
  if (!isRecord(parsed) || !hasOnly(parsed, ["rotations", "airtimeS", "peakHeightM", "landsWheelsDown", "canFlipFinishInAir"])) return undefined;
  const rotations = parsed.rotations;
  if (!isRecord(rotations) || !hasOnly(rotations, ["long", "vertical", "cross"])) return undefined;
  const numbers = [rotations.long, rotations.vertical, rotations.cross, parsed.airtimeS, parsed.peakHeightM];
  if (!numbers.every((item) => typeof item === "number" && Number.isFinite(item))) return undefined;
  if (typeof parsed.landsWheelsDown !== "boolean" || typeof parsed.canFlipFinishInAir !== "boolean") return undefined;
  return parsed as Answer;
}

const close = (actual: number, expected: number) =>
  Math.abs(actual - expected) <= Math.abs(expected) * 0.05 + 1e-9;

export function gradeSkateboard(task: Task, submission: Trace): TaskScore {
  const answer = parseAnswer(submission.answer);
  const expected = parseAnswer(task.expected);
  if (!answer) return { score: 0, reason: "Answer must be one strict JSON object with all seven fields and no extras." };
  if (!expected) throw new Error(`Task ${task.id} has an invalid reference answer.`);
  const checks: Array<[string, number, boolean]> = [
    ["rotations.long", 0.12, answer.rotations.long === expected.rotations.long],
    ["rotations.vertical", 0.12, answer.rotations.vertical === expected.rotations.vertical],
    ["rotations.cross", 0.12, answer.rotations.cross === expected.rotations.cross],
    ["airtimeS", 0.18, close(answer.airtimeS, expected.airtimeS)],
    ["peakHeightM", 0.16, close(answer.peakHeightM, expected.peakHeightM)],
    ["landsWheelsDown", 0.15, answer.landsWheelsDown === expected.landsWheelsDown],
    ["canFlipFinishInAir", 0.15, answer.canFlipFinishInAir === expected.canFlipFinishInAir],
  ];
  const failed = checks.filter(([, , pass]) => !pass).map(([name]) => name);
  const score = checks.reduce((sum, [, weight, pass]) => sum + (pass ? weight : 0), 0);
  return {
    score: Math.round(score * 100) / 100,
    reason: failed.length === 0 ? "All rotations, physics values, landing orientation, and feasibility are correct." : `Incorrect fields: ${failed.join(", ")}.`,
  };
}

export const benchmark = defineBenchmark({
  id: "benchmark-skateboard",
  name: "Skateboard Physics",
  tagline: "Can a model land the math behind twelve skateboard tricks?",
  tags: ["viral", "silly", "science"],
  category: "physical-reasoning",
  whatItMeasures: "Signed 3D rotation understanding, projectile-motion arithmetic, landing orientation, and whether a skateboard trick fits its airtime.",
  version: "0.1.0",
  status: "alpha",
  saturation: "unknown" as never,
  loadTasks,
  grade: gradeSkateboard,
  provenance: [
    {
      name: "Human-written skateboard trick glossary",
      kind: "human-written",
      url: "https://github.com/pooriaarab/benchmark-skateboard/blob/main/data/tricks.json",
      licence: "CC0-1.0",
      howToGet: "Read data/tricks.json; its sources array names each public reference page used to check factual trick combinations.",
      retrievedAt: "2026-10-15T00:00:00.000Z",
      contaminationNotes: "The glossary and public tasks are visible after 2026-10-15. Final comparisons should generate a private split with a fresh seed and keep it outside the package.",
      refresh: "Review the cited pages yearly or when a factual correction is reported, then record and review any table change.",
    },
    {
      name: "OpenStax projectile-motion equations",
      kind: "human-written",
      url: "https://openstax.org/books/university-physics-volume-1/pages/4-3-projectile-motion",
      licence: "CC-BY-4.0",
      howToGet: "Read section 4.3 and docs/methodology.md; only the standard constant-acceleration equations are used.",
      retrievedAt: "2026-10-15T00:00:00.000Z",
      contaminationNotes: "This is a public method reference, not copied task text. The generated numeric combinations use the benchmark seed.",
      refresh: "Recheck the linked section when the method changes; equations are otherwise stable.",
    },
    {
      name: "Seeded projectile-motion task generator",
      kind: "synthetic",
      url: "https://github.com/pooriaarab/benchmark-skateboard/blob/main/scripts/gen-tasks.mjs",
      licence: "MIT",
      howToGet: "Run `node scripts/gen-tasks.mjs --seed 20261015 --split public` from the repository root.",
      retrievedAt: "2026-10-15T00:00:00.000Z",
      contaminationNotes: "The 36 public tasks use seed 20261015. For a hidden split, run `node scripts/gen-tasks.mjs --seed N --split hidden`; data/tasks.hidden.jsonl is gitignored and must remain private.",
      refresh: "Generate and review a new public seed for each planned minor data release; do not replace a release in place.",
    },
  ],
  gradingMethod: "Strict JSON shape; exact signed rotations and booleans; 5% relative tolerance for airtime and peak height; weighted deterministic partial credit.",
  shareCardTitle: "Skateboard Physics",
});
