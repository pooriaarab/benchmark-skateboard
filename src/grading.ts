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

const MAX_FALLBACK_STARTS = 64;

function balancedObjects(text: string): string[] {
  const found: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === "}") {
      if (depth > 0) depth -= 1;
      if (depth === 0 && start >= 0) {
        found.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }
  if (found.length > 0) return found;
  // A stray unmatched "{" earlier in the text can swallow a real object; retry per brace.
  const spans: Array<[number, number]> = [];
  const starts: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "{") starts.push(index);
  }
  // Cap the rescans so a run of unmatched braces costs O(MAX_FALLBACK_STARTS * n), not O(n^2).
  for (const index of starts.slice(-MAX_FALLBACK_STARTS)) {
    let inner = 0;
    let innerString = false;
    let innerEscaped = false;
    for (let cursor = index; cursor < text.length; cursor += 1) {
      const char = text[cursor];
      if (innerString) {
        if (innerEscaped) innerEscaped = false;
        else if (char === "\\") innerEscaped = true;
        else if (char === '"') innerString = false;
        continue;
      }
      if (char === '"') innerString = true;
      else if (char === "{") inner += 1;
      else if (char === "}") {
        inner -= 1;
        if (inner === 0) {
          spans.push([index, cursor + 1]);
          break;
        }
      }
    }
  }
  spans.sort((a, b) => a[1] - a[0] - (b[1] - b[0]));
  return spans.map(([start, end]) => text.slice(start, end));
}

/** Strip one surrounding markdown fence and parse the last balanced JSON object. */
export function extractAnswerJson(text: string): unknown | undefined {
  if (text.length > 20_000) return undefined;
  let trimmed = text.trim();
  const fullFence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fullFence?.[1]) trimmed = fullFence[1].trim();
  else {
    const inlineFence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (inlineFence?.[1]) trimmed = inlineFence[1].trim();
  }
  const objects = balancedObjects(trimmed);
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const candidate = objects[index];
    if (candidate === undefined) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // try the previous balanced object
    }
  }
  return undefined;
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

const WEIGHTS = {
  rotations: 0.24,
  airtimeS: 0.2,
  peakHeightM: 0.18,
  landsWheelsDown: 0.19,
  canFlipFinishInAir: 0.19,
} as const;

function expectedLands(expected: Answer): boolean {
  return Number.isInteger(expected.rotations.long) && Number.isInteger(expected.rotations.cross);
}

function fieldChecks(
  task: Task,
  answer: Answer,
  expected: Answer,
): Array<[keyof typeof WEIGHTS, number, boolean]> {
  const minimum = minimumAirtime(task);
  const rotationsMatch =
    answer.rotations.long === expected.rotations.long &&
    answer.rotations.vertical === expected.rotations.vertical &&
    answer.rotations.cross === expected.rotations.cross;
  const physicsOk =
    close(answer.airtimeS, expected.airtimeS) && close(answer.peakHeightM, expected.peakHeightM);
  const expectedFlip = minimum !== undefined && expected.airtimeS + 1e-9 >= minimum;
  return [
    ["rotations", WEIGHTS.rotations, rotationsMatch],
    ["airtimeS", WEIGHTS.airtimeS, close(answer.airtimeS, expected.airtimeS)],
    ["peakHeightM", WEIGHTS.peakHeightM, close(answer.peakHeightM, expected.peakHeightM)],
    ["landsWheelsDown", WEIGHTS.landsWheelsDown, physicsOk && answer.landsWheelsDown === expectedLands(expected)],
    [
      "canFlipFinishInAir",
      WEIGHTS.canFlipFinishInAir,
      physicsOk && minimum !== undefined && answer.canFlipFinishInAir === expectedFlip,
    ],
  ];
}

export function skateboardFieldScores(
  task: Task,
  submission: Trace,
): { rotations: number; physics: number; landing: number } | undefined {
  const answer = parseAnswer(submission.answer);
  const expected = parseAnswer(task.expected);
  if (!answer || !expected) return undefined;
  const checks = fieldChecks(task, answer, expected);
  const sum = (names: (keyof typeof WEIGHTS)[]) =>
    checks.reduce((total, [name, weight, pass]) => total + (names.includes(name) && pass ? weight : 0), 0);
  return {
    rotations: sum(["rotations"]),
    physics: sum(["airtimeS", "peakHeightM"]),
    landing: sum(["landsWheelsDown", "canFlipFinishInAir"]),
  };
}

export function gradeSkateboard(task: Task, submission: Trace): TaskScore {
  const answer = parseAnswer(submission.answer);
  const expected = parseAnswer(task.expected);
  if (!answer) {
    return { score: 0, reason: "Answer must be one JSON object with all seven fields and no extras (one surrounding ``` fence allowed)." };
  }
  if (!expected) throw new Error(`Task ${task.id} has an invalid reference answer.`);
  const checks = fieldChecks(task, answer, expected);
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
