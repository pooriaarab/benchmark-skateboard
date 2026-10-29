# Skateboard study plan

Written 2026-10-29 before this study collects scores. This is a Git-recorded plan, not an independent registration.
Existing public E2E policies and the family report were inspected. Their results are prior evidence, not new observations.

## Question and hypotheses
H1: A glossary-assisted analytic policy reaches full credit, while empty, refuse, echo, and constant-zero policies do not.
H2: Multiplying both exact physics values by 1.06 removes physics and boolean credit; multiplication by 1.04 preserves it.
H3 (simulated): Recomputing physics improves the simulated population's score as corruption increases. Boolean repair alone may have no benefit.
These are instrument checks, not hypotheses about learned models. Report nulls and failures without changing the roster.

## Design and outcomes
Freeze benchmark 0.2.0 at 856161e4040f3e37a31105ec085094537974cf5a and its 72 public tasks (seed 20261015).
Use the public run(adapter) path. The analytic policy reads prompt quantities and the public glossary; it never reads reference answers.
Baselines: analytic, empty, refuse, echo, constant-zero, always-true (analytic numbers), reverse-sign (analytic with all rotations negated).
Sensitivity: physics factors 0.94, 0.96, 1.00, 1.04, 1.06, 1.10, with analytic rotations and booleans.
Extra virtual experiment (simulated): 20 seeded agents, seeds 1 through 20; corruption probabilities 0, .25, .5, .75, 1.
Each simulated agent independently corrupts rotations by adding .5 to long turns, and each numeric field by multiplying it by 1.10.
Common random draws pair all probability and control conditions for each agent and task. Initial booleans remain analytic.
Controls: none; physics repair (recompute both numeric fields from the prompt); boolean repair (recompute both booleans from submitted values).
All controls are simulated algorithms, not model prompting. No hidden task split is created or published.
Primary outcome: weighted mean score. Secondary: full-credit fraction and component credit.
Baseline and sensitivity means use a paired cluster bootstrap over tricks, retaining all worlds, with 2000 draws.
Baseline full-credit fractions carry Wilson 95% intervals over tasks, with dependence caveat; also report trick-cluster bootstrap intervals.
Simulated outcomes and paired control gains use bootstrap intervals over the 20 agent seeds, retaining each complete task panel.
No significance test or model ranking. Plots: coverage counts, baseline scores, sensitivity, simulated population and controls.

## Exclusions, stop, and failure modes
No task or low score is excluded. Invalid responses receive the benchmark score. Stop after the full fixed grid and one complete repeated run.
An execution exception stops the run for repair; disclose any protocol change before affected data collection.
Check raw-to-summary agreement, analytic ceiling, trivial floors, repeat semantic hashes, expected sample counts, and source hashes.
Anticipated failures: answer-key leakage, wrong sign convention, rounded threshold decisions, reused random streams, false extra sample counts, and bootstrap boundary collapse.

## Budget and disclosure
Zero paid calls; no external inference. Free hosted inference is not configured for this packet and its availability is not probed.
No humans, training, provider comparison, or deployment claims. Public templates may be memorized; numeric recombination is not a semantic holdout.
Publish code and generated traces in the PR. Do not publish to a venue, Zenodo, or arXiv. The parent handles publication.
