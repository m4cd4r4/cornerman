# Audit brief: the 1M quality test, before the full test (2026-11-11)

Audit the whole plan and its details before any full-test run. Read the evidence yourself; this
brief points at it and deliberately states no conclusions.

## What the test claims to measure

Whether cornerman's clear-and-continue relay beats one long 1M-context Claude Code session on an
80-checkpoint coding task. The result is meant for the cornerman README and product page.

## Read

- `PREDICTIONS.md`: frozen predictions, primary metric, claim rule, every re-freeze note.
- `TASK-DESIGN.md`: task, scoring, build blocks, pilot 1 and pilot 2 results (end of file).
- `task/harness/arm.mjs`: how each arm is set up and run (config floor, tools, cornerman pin, resume and usage-limit handling).
- `task/tools/compare.mjs`, `task/tools/check-rules.mjs`, `task/tools/tokens.mjs`, `task/tools/freeze.mjs`: analysis, rule scoring, K, freeze.
- Pilot data: `I:/Scratch/_q1m-pilot/<run>/` (`out/events.log`, `score.json`, `run/`, `home/.cornerman-headless/handovers/`). `cm250-sonnet-r99` is a setup-only install test, not a run.
- Cornerman source at the pinned tag: `I:/Scratch/_q1m-cornerman-v0.7.2` (v0.7.2, a8c3653). Pilot 2 ran 90eb44d.

## Questions to answer

1. Validity: is anything other than the arm different between arms (config floor, prompts, tools, timing, the shared subscription, usage-limit waits, the plugin version)? Is anything that differs not recorded?
2. Metric and K: is late pass rate over cp K..80 with K = 32 the right primary metric, and was K chosen without peeking at CM results?
3. Power: with pilot late scores of 44/49 in both arms, what difference can 5 runs per arm detect with the frozen bootstrap? Is the task too close to its ceiling?
4. Claim rule: does the frozen rule (interval above 0, below 0, spanning 0) support what the README would say?
5. Scorers: can any hidden test, probe or rule check favour one arm by construction (the rule 1 eval bug is one known case)?
6. Effort: estimate subscription usage per run from pilot data, and say how much of it is the test versus other use of the same subscription during those hours.
7. Scope: which arms and models are needed to answer the question above, and which can be cut.

## Report

One finding per line: severity (blocks the test / should fix / note), the evidence (file:line or
data path), and the fix. No percentages without n. Change no files: report only.
