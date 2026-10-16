import type { Task, TaskScore, Trace } from "benchmark-core";

export type Answer = {
  rotations: { long: number; vertical: number; cross: number };
  airtimeS: number;
  peakHeightM: number;
  landsWheelsDown: boolean;
  canFlipFinishInAir: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const hasOnly = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => key in value);

/** Strip one surrounding markdown fence and parse the last JSON object in the text. */
export function extractAnswerJson(text: string): unknown | undefined {
  if (text.length > 20_000) return undefined;
  let trimmed = text.trim();
  const fullFence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fullFence?.[1]) trimmed = fullFence[1].trim();
  else {
    const inlineFence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (inlineFence?.[1]) trimmed = inlineFence[1].trim();
  }
  let last: unknown;
  for (let index = 0; index < trimmed.length; index += 1) {
    if (trimmed[index] !== "{") continue;
    try {
      last = JSON.parse(trimmed.slice(index));
    } catch {
      // keep scanning for a later object
    }
  }
  return last;
}

export function parseAnswer(value: unknown): Answer | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = extractAnswerJson(value);
  if (!isRecord(parsed) || !hasOnly(parsed, ["rotations", "airtimeS", "peakHeightM", "landsWheelsDown", "canFlipFinishInAir"])) {
    return undefined;
  }
  const rotations = parsed.rotations;
  if (!isRecord(rotations) || !hasOnly(rotations, ["long", "vertical", "cross"])) return undefined;
  const numbers = [rotations.long, rotations.vertical, rotations.cross, parsed.airtimeS, parsed.peakHeightM];
  if (!numbers.every((item) => typeof item === "number" && Number.isFinite(item))) return undefined;
  if (typeof parsed.landsWheelsDown !== "boolean" || typeof parsed.canFlipFinishInAir !== "boolean") return undefined;
  return parsed as Answer;
}

const close = (actual: number, expected: number) =>
  Math.abs(actual - expected) <= Math.abs(expected) * 0.05 + 1e-9;

function minimumAirtime(task: Task): number | undefined {
  const value = task.metadata?.minimumAirtimeS;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function skateboardFieldScores(
  task: Task,
  submission: Trace,
): { rotations: number; physics: number; landing: number } | undefined {
  const answer = parseAnswer(submission.answer);
  const expected = parseAnswer(task.expected);
  if (!answer || !expected) return undefined;
  const rotationsMatch =
    answer.rotations.long === expected.rotations.long &&
    answer.rotations.vertical === expected.rotations.vertical &&
    answer.rotations.cross === expected.rotations.cross;
  const minimum = minimumAirtime(task);
  const rotScore = rotationsMatch ? 0.36 : 0;
  const physScore =
    (close(answer.airtimeS, expected.airtimeS) ? 0.18 : 0) +
    (close(answer.peakHeightM, expected.peakHeightM) ? 0.16 : 0);
  const landsOk =
    Number.isInteger(answer.rotations.long) && Number.isInteger(answer.rotations.cross);
  const flipOk = minimum !== undefined && answer.airtimeS + 1e-9 >= minimum;
  const landScore =
    (rotationsMatch && answer.landsWheelsDown === landsOk ? 0.15 : 0) +
    (rotationsMatch && minimum !== undefined && answer.canFlipFinishInAir === flipOk ? 0.15 : 0);
  return { rotations: rotScore, physics: physScore, landing: landScore };
}

export function gradeSkateboard(task: Task, submission: Trace): TaskScore {
  const answer = parseAnswer(submission.answer);
  const expected = parseAnswer(task.expected);
  if (!answer) {
    return { score: 0, reason: "Answer must be one JSON object with all seven fields and no extras (one surrounding ``` fence allowed)." };
  }
  if (!expected) throw new Error(`Task ${task.id} has an invalid reference answer.`);
  const minimum = minimumAirtime(task);
  const rotationsMatch =
    answer.rotations.long === expected.rotations.long &&
    answer.rotations.vertical === expected.rotations.vertical &&
    answer.rotations.cross === expected.rotations.cross;
  const landsOk =
    Number.isInteger(answer.rotations.long) && Number.isInteger(answer.rotations.cross);
  const flipOk = minimum !== undefined && answer.airtimeS + 1e-9 >= minimum;
  const checks: Array<[string, number, boolean]> = [
    ["rotations", 0.36, rotationsMatch],
    ["airtimeS", 0.18, close(answer.airtimeS, expected.airtimeS)],
    ["peakHeightM", 0.16, close(answer.peakHeightM, expected.peakHeightM)],
    [
      "landsWheelsDown",
      0.15,
      rotationsMatch && answer.landsWheelsDown === landsOk,
    ],
    [
      "canFlipFinishInAir",
      0.15,
      rotationsMatch && minimum !== undefined && answer.canFlipFinishInAir === flipOk,
    ],
  ];
  const failed = checks.filter(([, , pass]) => !pass).map(([name]) => name);
  const score = checks.reduce((sum, [, weight, pass]) => sum + (pass ? weight : 0), 0);
  const parts = skateboardFieldScores(task, submission);
  return {
    score: Math.round(score * 100) / 100,
    reason:
      failed.length === 0
        ? "All rotations, physics values, landing orientation, and feasibility are correct."
        : `Incorrect fields: ${failed.join(", ")}.`,
    ...(parts
      ? {
          details: {
            rotations: parts.rotations,
            physics: parts.physics,
            landing: parts.landing,
          },
        }
      : {}),
  };
}
