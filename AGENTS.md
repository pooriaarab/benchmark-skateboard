# Working on benchmark-skateboard

## Commands

- Install with `npm ci` on Node.js 20 or newer.
- Run the full gate with `npm run ci:local` before every push.
- Regenerate public tasks with `node scripts/gen-tasks.mjs --seed 20261015 --split public`.
- Generate a private candidate split with `node scripts/gen-tasks.mjs --seed N --split hidden`; never commit it.
- Regenerate `data/PROVENANCE.md` after building with `npm run provenance`.
- Add no unit tests. Extend `scripts/e2e.mjs` through a public surface.

## Benchmark contracts

Keep `data/tricks.json`, generated tasks, `docs/methodology.md`, and the deterministic grader in sync. Write anticipated grader failures in `docs/grading.md` before changing grader code.

The answer is strict JSON with signed turns on long, vertical, and cross axes; airtime; peak height; wheels-down orientation; and feasibility. Preserve the documented axis convention, 5% numeric tolerance, exact booleans, and partial-credit weights unless one focused issue changes the contract.

The mock run must include good and bad results. E2E must reject empty, random, always-yes, and irrelevant repeated-tool submissions while reference answers score 1.

Never read provider keys from repository files. OpenRouter uses `OPENROUTER_API_KEY`. OpenAI-compatible providers use `OPENAI_BASE_URL` and `OPENAI_API_KEY`.

## Contributions

Open an issue before a branch. Use `bska-<issue>-<slug>` and `[bska-<issue>] Imperative subject`. Keep pull requests below 500 counted lines. Do not edit workflows, merge your own pull request, or push `release`.
