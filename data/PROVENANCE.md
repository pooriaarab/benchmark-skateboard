# Skateboard Physics provenance

This file is generated from the benchmark definition.

## Human-written skateboard trick glossary

- Kind: `human-written`
- URL: https://github.com/pooriaarab/benchmark-skateboard/blob/main/data/tricks.json
- Licence: `CC0-1.0`
- Retrieved: 2026-10-15T00:00:00.000Z
- How to get it: Read data/tricks.json; its sources array names each public reference page used to check factual trick combinations.
- Contamination notes: The glossary and public tasks are visible after 2026-10-15. Final comparisons should generate a private split with a fresh seed and keep it outside the package.
- Refresh: Review the cited pages yearly or when a factual correction is reported, then record and review any table change.

## Seeded projectile-motion task generator

- Kind: `synthetic`
- URL: https://github.com/pooriaarab/benchmark-skateboard/blob/main/scripts/gen-tasks.mjs
- Licence: `MIT`
- Retrieved: 2026-10-15T00:00:00.000Z
- How to get it: Run `node scripts/gen-tasks.mjs --seed 20261015 --split public` from the repository root.
- Contamination notes: The 36 public tasks use seed 20261015. For a hidden split, run `node scripts/gen-tasks.mjs --seed N --split hidden`; data/tasks.hidden.jsonl is gitignored and must remain private.
- Refresh: Generate and review a new public seed for each planned minor data release; do not replace a release in place.
