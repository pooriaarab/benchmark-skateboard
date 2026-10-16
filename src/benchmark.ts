import { defineBenchmark } from "benchmark-core";
import { gradeSkateboard } from "./grading.js";
import { loadTasks } from "./tasks.js";

export { gradeSkateboard, parseAnswer } from "./grading.js";
export { loadTasks, loadTasksFile, setTasksPath, getTasksPath } from "./tasks.js";

export const benchmark = defineBenchmark({
  id: "benchmark-skateboard",
  name: "Skateboard Physics",
  tagline: "Can a model land the math behind two dozen skateboard tricks?",
  tags: ["viral", "silly", "science"],
  category: "physical-reasoning",
  whatItMeasures:
    "Signed 3D rotation understanding, projectile-motion arithmetic, landing orientation, and whether a skateboard trick fits its airtime.",
  version: "0.2.0",
  status: "alpha",
  loadTasks,
  grade: gradeSkateboard,
  provenance: [
    {
      name: "Human-written skateboard trick glossary",
      kind: "human-written",
      url: "https://github.com/pooriaarab/benchmark-skateboard/blob/main/data/tricks.json",
      licence: "CC0-1.0",
      howToGet:
        "Read data/tricks.json; its sources array names each public reference page used to check factual trick combinations.",
      retrievedAt: "2026-10-15T00:00:00.000Z",
      contaminationNotes:
        "The glossary and public tasks are visible after 2026-10-15. Final comparisons should generate a private split with a fresh seed and keep it outside the package.",
      refresh:
        "Review the cited pages yearly or when a factual correction is reported, then record and review any table change.",
    },
    {
      name: "OpenStax projectile-motion equations",
      kind: "human-written",
      url: "https://openstax.org/books/university-physics-volume-1/pages/4-3-projectile-motion",
      licence: "CC-BY-4.0",
      howToGet: "Read section 4.3 and docs/methodology.md; only the standard constant-acceleration equations are used.",
      retrievedAt: "2026-10-15T00:00:00.000Z",
      contaminationNotes:
        "This is a public method reference, not copied task text. The generated numeric combinations use the benchmark seed.",
      refresh: "Recheck the linked section when the method changes; equations are otherwise stable.",
    },
    {
      name: "Seeded projectile-motion task generator",
      kind: "synthetic",
      url: "https://github.com/pooriaarab/benchmark-skateboard/blob/main/scripts/gen-tasks.mjs",
      licence: "MIT",
      howToGet: "Run `node scripts/gen-tasks.mjs --seed 20261015 --split public` from the repository root.",
      retrievedAt: "2026-10-15T00:00:00.000Z",
      contaminationNotes:
        "The 72 public tasks use seed 20261015. For a hidden split, run `node scripts/gen-tasks.mjs --seed N --split hidden`; `.hidden/tasks.jsonl` is gitignored and must remain private.",
      refresh: "Generate and review a new public seed for each planned minor data release; do not replace a release in place.",
    },
  ],
  gradingMethod:
    "Strict JSON shape; exact signed rotations in turns; 5% relative tolerance for airtime and peak height; landing and feasibility booleans scored only when both physics values are within tolerance.",
  shareCardTitle: "Skateboard Physics",
});
