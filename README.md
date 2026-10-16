# benchmark-skateboard

[![npm](https://img.shields.io/npm/v/benchmark-skateboard)](https://www.npmjs.com/package/benchmark-skateboard) [![CI](https://github.com/pooriaarab/benchmark-skateboard/actions/workflows/ci.yml/badge.svg)](https://github.com/pooriaarab/benchmark-skateboard/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/benchmark-skateboard)](./LICENSE) [![types](https://img.shields.io/badge/TypeScript-types-3178c6)](#sdk)

[AI Benchmark Index](https://private-repo-337e.com/benchmarks/benchmark-skateboard) · [npm](https://www.npmjs.com/package/benchmark-skateboard) · [HTTP API](#http-api) · [MCP](#model-context-protocol)

Can a model keep a kickflip, a heelflip, and gravity straight at the same time? **benchmark-skateboard** measures signed 3D trick rotations, projectile-motion arithmetic, wheels-down orientation, and whether a trick can finish before landing.

```bash
npx benchmark-skateboard run --provider mock
```

A real offline run on the 36 public tasks starts like this:

```text
# Skateboard Physics

- Model: `mock:1`
- Score: **58.3%**
- 95% CI: 41.7%–72.2%
- Tasks: 36

Breakdown — rotations: 21.0%, physics: 19.8%, landing: 17.5%
```

The trick glossary is a human-written CC0 table checked against linked public trick definitions. A seeded MIT-licensed generator combines its 12 tricks with Earth, Moon, and Mars flight conditions.

## Install

Node.js 20 or newer is required.

```bash
npm install benchmark-skateboard
```

## Run a model

The mock provider is deterministic, offline, and needs no key. It deliberately returns good and bad answers so you can inspect both grading paths.

For a real model through OpenRouter:

```bash
npx benchmark-skateboard run --provider openrouter --model openai/gpt-4o-mini
```

For another OpenAI-compatible endpoint, set `OPENAI_BASE_URL` and `OPENAI_API_KEY`, then choose `--provider openai --model <id>`. The package never reads keys from repository files.

There is no public leaderboard yet. The sample above is a wiring check, not a model result.

## Read the score

Each task expects this JSON shape:

```json
{"rotations":{"long":1,"vertical":0,"cross":0},"airtimeS":0.571,"peakHeightM":0.4,"landsWheelsDown":true,"canFlipFinishInAir":true}
```

The grader gives 24% to exact signed rotations together, 38% to airtime and peak height within 5%, and 38% to landing and feasibility booleans, which count only when airtime and peak height are both within tolerance. One surrounding Markdown fence, a short preamble, or trailing prose around the JSON is fine. Wrong rotation signs lose the whole rotation block. Invalid JSON, missing fields, extra fields, and non-finite values score zero. Every row includes a reason; `run` and `score` also print rotations/physics/landing breakdown means plus a bootstrap 95% confidence interval.

See [grading](docs/grading.md) for failure modes and weights and [methodology](docs/methodology.md) for axes, equations, and assumptions.

## Data and reproducibility

`data/tricks.json` contains the reviewed trick table and its source links. `data/tasks.jsonl` contains 36 public tasks: 12 tricks across three gravity and launch-speed variants. Rebuild them exactly:

```bash
node scripts/gen-tasks.mjs --seed 20261015 --split public
```

Generate a private candidate split with a different seed:

```bash
node scripts/gen-tasks.mjs --seed 88200416 --split hidden
```

The hidden file lands in `.hidden/tasks.jsonl` (gitignored) and is excluded from the npm package. Point a local run at another split with `--tasks <path>` on the CLI, `run(adapter, { tasks })` in the SDK, or `BENCHMARK_SKATEBOARD_TASKS` for the HTTP API and MCP server. `data/PROVENANCE.md` records licences, retrieval date, contamination cutoff, exact commands, and refresh cadence.

## SDK

```ts
import { benchmark, run, score } from "benchmark-skateboard";
```

`run(adapter, options)` returns a standard `RunReport`. `score(taskId, submission)` applies the same deterministic grader used by every other surface.

## CLI

The command set is `list`, `show <task>`, `run`, `score <results.json>`, `card <report.json>`, `provenance`, `index-entry`, `serve`, and `mcp`. Add `--json` for machine-readable output. `card` writes a 1200×630 SVG with the benchmark name, model, score, and directory URL.

## Model Context Protocol

Start the stdio server:

```bash
npx benchmark-skateboard mcp
```

It exposes `list_tasks`, `get_task`, `score_answer`, `run_benchmark`, and `get_provenance`.

## HTTP API

Import `handler` from `benchmark-skateboard/api`, or start a local server with `npx benchmark-skateboard serve`. The fetch-style handler works in Node.js and Cloudflare Workers.

| Method | Route |
| --- | --- |
| `GET` | `/health` |
| `GET` | `/v1/tasks` |
| `GET` | `/v1/tasks/:id` |
| `POST` | `/v1/score` |
| `GET` | `/v1/provenance` |
| `GET` | `/v1/index-entry` |

Put authentication and rate limits in front of a public score endpoint.

## Limits and known weaknesses

- The flight model ignores drag, deck inertia, foot contact, body rotation, and unequal landing height.
- Minimum trick times are declared benchmark assumptions, not measured athlete limits.
- Trick axes compress motions such as an impossible into one idealized rotation.
- Public prompts can enter training data. Use a fresh private seed for final comparisons.
- A 36-task sample has wide confidence intervals and should not support small ranking claims.
- The grader checks the stated model, not whether a generated animation looks convincing.

## Prior art and sources

The coordinate framing was informed by the physical viewpoint in [Skateboard Tricks and Topological Flips](https://arxiv.org/abs/2108.06307). Trick facts were checked against the pages named in `data/tricks.json`; equations follow OpenStax. Only short factual relationships were retained, in original wording.

## Development

```bash
npm ci
npm run ci:local
```

The gate builds the package, rejects trivial answers, runs the mock over every task, calls every CLI and HTTP route, opens the MCP server with the official client, and writes `artifacts/e2e-report.json`.

Version 0.1.0 is alpha. Schemas and task assumptions may change before 1.0. Report defects in [GitHub Issues](https://github.com/pooriaarab/benchmark-skateboard/issues).

## License

[MIT](LICENSE) © Pooria Arab. The original glossary table is also offered under CC0-1.0 as recorded in `data/tricks.json`.
