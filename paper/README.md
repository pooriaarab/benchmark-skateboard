# Skateboard paper packet

Use Node 22 with npm 10, Python 3, Tectonic, and Poppler. From the repository root, run `npm ci`, then `sh paper/template/reproduce.sh`.
The command builds the benchmark, runs the complete experiment twice, renders tables and four figures, builds the PDF, and verifies the packet.
Output: `paper/skateboard-paper.pdf`. PDFs and downloaded styles stay untracked. No inference service or credential is used.
The build downloads the official NeurIPS style and checks its pinned archive hash. Tectonic can download TeX dependencies.

`PREREG.md` records the design before results and a bootstrap implementation correction. It is not an external registration.
`data/runs.generated.json` contains runner reports and submitted answers. `summary.generated.json` contains intervals and counts.
`repeat.generated.json` records semantic hashes for both complete passes. `provenance.generated.json` records source and plan hashes.
The simulated population and all simulated repairs are scripted, not learned models. Free hosted inference was not configured or probed.
Fixed-policy intervals resample whole tricks. Wilson full-answer intervals assume independent tasks. Simulated intervals resample agent seeds.
The public panel has shared templates. Boundary bootstrap intervals can collapse. These limits prevent population or deployment claims.

The unchanged `template/` comes from the accepted honesty pilot, PR 24. All experiment code and prose are skateboard-specific.
The family paper was consulted for the task count, release scope, and prior validation. No family results enter this study's data.
Paper prose and generated figures: CC-BY-4.0. Software and glossary retain their existing licenses.
Do not publish or merge automatically. The parent handles the completed packet. Independent replication and task validation remain welcome.

Local CI passes on Node 22.23.4 and npm 10.9.9. Node 26 with npm 12 fails the existing package-list E2E assertion because npm changes its JSON shape.
