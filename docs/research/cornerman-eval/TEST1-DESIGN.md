# Test 1: carry-forward fidelity (design, 2026-11-16; not built, nothing frozen)

Claim C1 (PROJECT-PLAN.md): everything relevant the user said or decided before a clear is
(a) **written** into the handover and (b) **acted on** after the clear. Scored per fact type.

## Fact types (8), each with a pool of 6 seeded variants

| Type | Example variant | Written check (regex on handover) | Acted-on check (hidden, after the clear) |
|:--|:--|:--|:--|
| ruling | "Never use floats for money, integer cents only." | `integer cents` | add-fee task: test asserts integer-cent math |
| decision | "We picked SQLite over JSON files." | `SQLite` | storage task: test asserts the SQLite module is used |
| do-not | "Don't touch src/legacy/." | `src/legacy` | refactor task: `git diff --stat` shows no src/legacy change |
| reversed | early "use tabs", later "actually, 2 spaces" | the later wording, not the earlier | format check on new files: 2 spaces |
| open question | "Before you change the export format, ask me." | the question verbatim | export task: agent stops and asks (stream shows a question, no edit to export) |
| in-flight | step 3 of 5 half done, named in a turn | the step | first action after the clear continues step 3, not step 1 |
| path | "the config lives at config/ledger.toml" | `config/ledger.toml` | config task edits that file |
| number | "rate limit is 37 per minute" | `37` | limiter test asserts 37 |

Variants differ in wording and values per trial (seeded), so nothing is memorised across trials.
Each acted-on task gives no hint of the fact; a separate reviewer checks every pair for fairness
(the task must be solvable both ways, and only the fact decides which).

## Fixture

A small Node repo ("ledger": about 12 source files and about 60k tokens of docs and fixtures the
work turns must read, so context grows on real content; pilot 4 showed filler gets filtered).

## Arms

| Arm | How the facts arrive | How the clear happens |
|:--|:--|:--|
| CM-headless | in the starting brief (as headless users give them) | `run.mjs` chain, nudge at a low threshold |
| CM-interactive | spread over typed turns, some typed mid-turn (queued) | real TUI in tmux, relay on, nudge at a low threshold |
| Default-compact | same turns as CM-interactive | `/compact` at the same point |
| Default-full | same turns | no clear: the ceiling for acted-on |

Chains: the clear point is hit 1, 2 or 3 times (thresholds set so each segment does about the same
work), so a fact from before clear 1 is checked after clear 3 (carry.mjs carries open items only).

## Size and models

Sonnet 5.5 first: 4 arms x 8 trials = 32 trials (each covers all 8 fact types, 256 fact checks).
Then Haiku 5.5 and Opus 5.5, same design, CM arms + Default-full only. Fork every trial from a
cached phase-A transcript where the arm allows (headless and Default-full), to keep cost down.

## Scoring and reporting

- Per fact type and arm: written rate (CM arms only), acted-on rate, Wilson 95% interval.
- Headline: CM-interactive and CM-headless acted-on vs Default-full, per type. A type below
  Default-full by more than its interval is a leak to fix in cornerman.
- Failure classes for each miss: not written / written but not acted on / acted on wrongly
  (e.g. the reversed ruling's earlier wording).
- Predictions frozen in PREDICTIONS.md (sha256) before any real trial.

## Build order (all US$0 until the last step)

1. Fixture + fact pools + checkers; reviewer pass on fairness.
2. Driver: headless (run.mjs in the rig container) and TUI (tmux send-keys / capture-pane; detects
   turn end from the transcript JSONL, not the screen).
3. Stub dry checks in the rig: each checker sees a passing and a failing case (a stub that obeys
   and one that drops each fact type).
4. One real Sonnet trial per arm (smoke), then the batch on the VPS, 3 containers at a time.

## Known findings to carry into the fix list

- Fixed on fix/rulings-skip-own-ask: the threshold ask was logged as a user ruling (#215 side effect).
- First-run welcome text is in the model's reply in `claude -p` output (seen on the VPS real call).
