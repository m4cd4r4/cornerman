# Predictions (written 2026-11-09, before any run of the task)

Written by Claude under Macdara's delegation (2026-11-09 21:13 AWST: "use your best judgement
... make the decisions on my behalf"). Frozen with sha256 in `task/frozen.sha256.json` before the
first pilot call. The pilot is calibration (K, difficulty, cost); it is not a scored result. Any
retune after the pilot re-freezes this file with a dated note below, and is allowed on Default
pilot data only.

## Set-up facts measured before freezing

- Config floor 46,736 (Default) and 46,882 (CM-250) tokens; window 1,000,000; Sonnet 5.5.
- Cornerman 0.7.2 from the GitHub marketplace, relay `scripts/run.mjs --nudge-at N`.
- Default and Compact-250 run one session and resume that same session when a turn ends early.
  CM arms run the relay; a usage-limit stop waits 20 minutes and resumes (logged, not scored).

## Primary analysis (fixed now)

- Primary metric: hidden-test pass rate over the late segment, checkpoints K..80, K = the first
  checkpoint the Default pilot requests after its work tokens pass 350,000 (tools/tokens.mjs).
- Per arm vs Default: paired by checkpoint and run; bootstrap B = 10,000, 95% interval of the
  difference in late pass rate.
- Claim rule: "clearing helps" only if the interval for a CM arm vs Default is above 0. Below 0:
  "clearing hurts". Spanning 0: "no large effect at n = 5", never "no effect".
- A run that ends on infrastructure (usage limit it could not wait out, crash) is INVALID, kept,
  excluded and rerun by key.

## Predictions

| # | Prediction | My confidence |
|:--|:--|:--|
| P1 | Default's peak context passes 800,000 and it auto-compacts at least once before cp80 | 70% |
| P2 | Default late pass rate in the pilot lands inside 40-80% (task neither ceiling nor floor) | 45% |
| P3 | CM-250 late pass rate >= Default late pass rate (pilot, same task) | 60% |
| P4 | In the full test, CM-250 vs Default interval is above 0 (clearing helps) | 30% |
| P5 | Rule violations after Default's first compaction exceed CM-250's over the same checkpoints | 55% |
| P6 | Probe answers right: CM-250 >= Default | 60% |
| P7 | API-equivalent cost per run: CM-250 <= 0.7 x Default | 65% |
| P8 | Regressions (earlier checkpoints broken on the final tree): CM-250 <= Default | 55% |
| P9 | Compact-250 compacts between 220k and 280k tokens | 80% |
| P10 | Among CM arms, the best late pass rate is not CM-500 | 60% |

What would make the test "not testable": Default and CM-250 both pass >= 95% of late checkpoints
in the pilot (ceiling), or both pass <= 10% (floor). Either sends the task back for a retune
before Stage 3, never a published comparison.

## Re-freezes

- 2026-11-09 13:35 UTC: added `tools/compare.mjs` (the bootstrap named above, self-tested) while
  the pilot was at cp02, before any score existed. No prediction or threshold changed.
- 2026-11-10 (before pilot 2): the task grew from 40 to 80 checkpoints after pilot 1, whose
  Default run peaked at 414k tokens and never compacted, so it could not reach the regime the
  test is about. Changed: "K..40" to "K..80" in the primary metric and "before cp40" to "before
  cp80" in P1. `tools/mutants.mjs` gained `--jobs` and `tools/score-selftest.mjs` counts the
  checkpoints instead of assuming 40. No confidence, threshold, claim rule or K rule changed.
  Pilot 1 is calibration only and is not scored against these predictions.
- 2026-11-11 (after pilot 2, before the full test): rule 1's `eval(` pattern also matched a method
  of the agent's own named eval (`env.eval(node)`), 24 false hits in cm250-sonnet-r2 and none in
  Default. `tools/check-rules.mjs` now counts a member call only on the global object
  (`globalThis.eval(`), with two new cases in `tools/rule-negatives.mjs` (18/18 OK). A scorer
  bug fix found on CM pilot data; no prediction, threshold, claim rule or K rule changed.
  K = 32, from the Default pilot (work passed 350,000 before its cp32 request).
- 2026-11-11 (before the full test): the cornerman install is pinned. Both pilots installed from
  GitHub main unpinned and logged only "0.7.2": pilot 1 got 7728e73, pilot 2 got 90eb44d. The full
  test installs tag v0.7.2 (a8c3653) from a checked local clone and logs the sha
  (`harness/arm.mjs`, CM_SHA). On the headless relay path v0.7.2 differs from pilot 2 in what the
  agent is told, not in the runner: the nudge text is reworded with the same steps, and save.mjs
  now prints a "save again" note when a handover lacks "Read first", "Decided, not yet applied" or
  "Open questions" (all 5 pilot 2 handovers lacked them, so it would have fired on each save).
  The runner (`scripts/run.mjs`, `lib/run.mjs`, resume prompt, stall guard) is unchanged. Pilot 2's
  CM-250 numbers therefore describe 90eb44d; they were calibration only and K comes from Default,
  which has no plugin, so K stays 32. No prediction, threshold or claim rule changed. Pilot run
  folders moved to I:/Scratch/_q1m-pilot so compare.mjs reads only full-test runs.
