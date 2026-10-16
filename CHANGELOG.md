# Changelog

## 0.2.0 - 2026-10-16

### Changed

- Scoring now requires all three rotation axes to match together, and landing and feasibility booleans earn credit only when `airtimeS` and `peakHeightM` are both inside 5% tolerance. `canFlipFinishInAir` is graded against the expected airtime instead of the answer's own. Weights rebalanced to 24% rotations, 38% physics, 38% booleans.
- The task set grew to 72 tasks: 24 tricks (adding half flips and one-and-a-half flips that cannot land wheels down) across three gravity conditions, with launches sometimes too weak to finish the rotation.
- Hidden splits write to `.hidden/tasks.jsonl` (not shipped on npm), shuffle order, and resample any launch speed within 10% of the public twin so expected answers always differ.
- The answer parser strips one surrounding fence or accepts prose around the answer; the last balanced JSON object wins.
- Fixed `run(adapter, { tasks })` ignoring the split after an earlier run: every run now builds a fresh benchmark object.
- A tasks path can reach every surface: `--tasks` on the CLI (including `serve` and `mcp`), `run({ tasks })` and `score(id, submission, { tasks })` in the SDK, `?tasks=` on each HTTP route, and `tasksPath` on MCP tools (remote surfaces restrict paths to inside the package).
- CLI `run`/`score` and MCP `run_benchmark` reports include `breakdown` means for rotations, physics, and landing; `run_benchmark` also accepts `provider` (`openrouter`, `openai`, `mock`).

**0.1.0 scores are not comparable to 0.2.0** because weights, grading rules, and task physics changed.
