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

- Primary metric: hidden-test pass rate over the late segment, checkpoints K..40, K = the first
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
| P1 | Default's peak context passes 800,000 and it auto-compacts at least once before cp40 | 70% |
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
