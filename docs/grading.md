# Grading

The grader reads one JSON object and awards deterministic partial credit. It does not call a model.

## Ways this grader can fail

These risks were written down before the grader implementation.

- A malformed or prose-wrapped answer could be mistaken for JSON.
- JavaScript coercion could turn strings, `null`, `NaN`, or infinity into valid numbers.
- Absolute tolerances could be too generous for small values or reject a correct rounded result.
- A sign-insensitive comparison could treat a heelflip as a kickflip.
- A constant answer could collect too much credit from common zero rotations and `true` booleans.
- Feasibility could be graded from the model's own numbers instead of the task's fixed assumptions.
- Floating-point noise at the feasibility threshold could change a result.
- The generator and grader could silently disagree about formulas, axes, or precision.

The E2E gate therefore sends empty text, random text, `yes`, and a repeated irrelevant tool call and requires zero. It also scores every reference answer highly and checks targeted near-misses for sign, numeric tolerance, and feasibility.

## Score

| Field | Weight | Rule |
| --- | ---: | --- |
| `rotations.long` | 0.12 | Exact signed turns |
| `rotations.vertical` | 0.12 | Exact signed turns |
| `rotations.cross` | 0.12 | Exact signed turns |
| `airtimeS` | 0.18 | Within 5% of `2 × launchSpeed / gravity` |
| `peakHeightM` | 0.16 | Within 5% of `launchSpeed² / (2 × gravity)` |
| `landsWheelsDown` | 0.15 | Exact boolean |
| `canFlipFinishInAir` | 0.15 | Exact boolean from reference airtime and the glossary minimum |

All seven fields and no extra fields are required. Invalid JSON, the wrong shape, or a non-finite number scores zero. Valid answers receive partial credit and a reason naming each failed field. Boundary comparisons allow `1e-9` seconds of floating-point slack.

The convention is viewed from the rider's tail toward the nose: positive long-axis rotation is a kickflip and negative is a heelflip. Positive vertical rotation is frontside; negative is backside. Positive cross-axis rotation tips the nose forward. A finished trick lands wheels-down when the long- and cross-axis turns are whole numbers. Feasibility assumes a maximum 2.5 turns per second plus the glossary's setup time; the published minimum is fixed per trick.
