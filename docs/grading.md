# Grading

The grader reads model text, strips one surrounding Markdown code fence when present, parses the last JSON object in the text, and awards deterministic partial credit. It does not call a model.

## Ways this grader can fail

- Answers longer than 20,000 characters score zero (bounds the JSON scan).
- Malformed JSON, extra fields, missing fields, or non-finite numbers score zero.
- A one-line preamble or a single ```json fence around the answer is accepted; multiple objects use the last parseable object.
- Rotation credit is all-or-nothing: all three signed turn values must match; a heelflip is not a kickflip.
- `airtimeS` and `peakHeightM` must be within 5% relative tolerance of the values from the prompt's launch speed and gravity.
- `landsWheelsDown` is graded only when rotations match; it must equal whether the answer's long- and cross-axis turns are whole numbers.
- `canFlipFinishInAir` is graded only when rotations match; it must equal whether the answer's `airtimeS` meets the prompt minimum.
- Guessing `true` on the landing booleans without correct rotations or physics cannot collect that weight.
- Constant JSON answers that ignore the prompt score at or below chance on the full task set (verified in E2E).

## Score

| Field | Weight | Rule |
| --- | ---: | --- |
| `rotations` (all axes) | 0.36 | Exact signed turns together |
| `airtimeS` | 0.18 | Within 5% of `2 × launchSpeed / gravity` |
| `peakHeightM` | 0.16 | Within 5% of `launchSpeed² / (2 × gravity)` |
| `landsWheelsDown` | 0.15 | Matches integer long/cross rule when rotations match |
| `canFlipFinishInAir` | 0.15 | Matches answer airtime vs prompt minimum when rotations match |

Runs and rescored reports also print a breakdown mean for rotations, physics (airtime + peak), and landing (both booleans).

Rotations are measured in full turns (1 means one 360° rotation on that axis). Viewed from the tail toward the nose: positive long-axis rotation is a kickflip and negative is a heelflip. Positive vertical rotation is frontside; negative is backside. Positive cross-axis rotation tips the nose forward.
