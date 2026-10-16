# Changelog

## 0.2.0 - 2026-10-16

### Changed

- Scoring now requires all three rotation axes to match before awarding rotation credit, gates landing booleans on correct rotations, and derives feasibility from the model's own `airtimeS`. Answers may include one surrounding Markdown code fence or a short preamble.
- Public `data/tasks.jsonl` was regenerated with wider launch speeds so physics and feasibility must be computed per task.
- Hidden splits are written to `.hidden/tasks.jsonl` (not shipped on npm). Use `--tasks`, `run({ tasks })`, or `?tasks=` to evaluate a split file.
- CLI `run` and `score` JSON include `breakdown` means for rotations, physics, and landing.

**0.1.0 scores are not comparable to 0.2.0** because weights and task physics changed.
