# Grading

The grader reads model text, strips one surrounding Markdown code fence when present, parses the last balanced JSON object in the text, and awards deterministic partial credit. It does not call a model.

## Ways this grader can fail

- Answers longer than 20,000 characters score zero (bounds the JSON scan).
- Malformed JSON, extra fields, missing fields, or non-finite numbers score zero.
- A one-line preamble, a single ```json fence around the answer, or prose after the JSON is accepted; multiple balanced objects use the last parseable one. A stray unmatched `{` can still hide the real object (the parser falls back to the widest balanced span).
- Rotation credit is all-or-nothing: all three signed turn values must match; a heelflip is not a kickflip.
- `airtimeS` and `peakHeightM` are compared with the UNROUNDED physics values `2 × launchSpeed / gravity` and `launchSpeed² / (2 × gravity)` recomputed from the task metadata, not the stored three-decimal answer. The tolerance is 5% relative or 0.0005 absolute, whichever is larger, so a correctly rounded three-decimal answer always fits.
- `landsWheelsDown` must equal whether the EXPECTED long- and cross-axis turns are whole numbers; `canFlipFinishInAir` must equal whether the unrounded reference airtime meets the prompt minimum.
- Both booleans only earn credit when `airtimeS` and `peakHeightM` are both inside tolerance, so table lookups, wrong formulas, and self-reported airtimes cannot cash the landing and feasibility checks.
- Guessing `true` on the landing booleans fails on about half the tasks: the set includes half-flip and one-and-a-half-flip tricks that never land wheels down, and launches too weak to finish the rotation.
- Constant JSON answers that ignore the prompt score at or below chance on the full task set (verified in E2E).

## Score

| Field | Weight | Rule |
| --- | ---: | --- |
| `rotations` (all axes) | 0.24 | Exact signed turns together |
| `airtimeS` | 0.20 | Within 5% (min slack 0.0005) of the unrounded `2 × launchSpeed / gravity` |
| `peakHeightM` | 0.18 | Within 5% (min slack 0.0005) of the unrounded `launchSpeed² / (2 × gravity)` |
| `landsWheelsDown` | 0.19 | Equals expected rotation geometry when physics is within tolerance |
| `canFlipFinishInAir` | 0.19 | Equals expected airtime vs prompt minimum when physics is within tolerance |

Runs and rescored reports also print breakdown means for rotations, physics (airtime + peak), and landing (both booleans), averaged across every task (unparseable answers count as zero in each bucket). The CLI, SDK `run`, MCP tools, and HTTP routes accept a tasks-path override (`--tasks`, `run({ tasks })`, `tasksPath`, `?tasks=`); remote surfaces restrict the path to `*.jsonl` files under `data/`. `createBenchmark(path)` builds an instance bound to one file; there is no process-global tasks path, so a later run can never inherit a stale split.

Rotations are measured in full turns (1 means one 360° rotation on that axis). Viewed from the tail toward the nose: positive long-axis rotation is a kickflip and negative is a heelflip. Positive vertical rotation is frontside; negative is backside. Positive cross-axis rotation tips the nose forward.
