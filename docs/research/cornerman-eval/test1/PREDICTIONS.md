# Test 1 predictions (DRAFT 2026-11-17, not frozen)

Written by Claude before any scored Test 1 run. Frozen with sha256 (in `frozen.sha256.json` next to
this file) only once the cm calibration pilot has set the nudge. Any change after freezing is a dated
note below and a re-freeze, allowed on pilot data only.

## Fixed design

- Model Sonnet 5.5, interactive TUI driven by tmux, cornerman from the marketplace at ref main
  (sha 107ff1f in the pilots; 0.7.4 is not released), recorded per trial in cornerman.txt; auto-memory off.
- Arms: **cm** (cornerman relay clears by itself), **compact** (`/compact` every 3 work turns),
  **full** (no clear, the ceiling).
- K = 3 clears or compactions; W = 3K + 1 = 10 work turns in every arm, 6 npm doc files a turn.
- 24 facts per trial: 8 types x 3 slots (facts.mjs at the frozen commit), seeded per trial.
- n = 8 trials per arm (seeds 1-8, the same seeds in every arm): 24 trials, 192 facts per arm,
  24 per type per arm.
- Nudge: 70,000 tokens (cm pilot s902: clears after work turns 2, 5, 8, sessions peak 81-99k; at
  35,000 (s901) the relay spent its default budget of 3 clears by work turn 2, then one 31k-211k
  session). Relay budget: the product default, 3 clears per window.
- A trial that ends on infrastructure (usage limit, crash, driver TIMEOUT on a probe, a checker
  error) is INVALID: kept, excluded, rerun by key. A cm trial with `clearsInWork` < K is kept and
  reported, and counts as valid (the relay decides when to clear; that is part of what is tested).

## Scoring

- Acted on: the checker's result per fact. obeyed = 1, violated = 0, not-attempted = 0 (reported
  separately as a failure class).
- Written (cm only): every `written` regex matches each handover filed after the fact's last plant.
- Per type and arm: acted-on rate with a Wilson 95% interval. Per type, cm vs full and cm vs
  compact: the difference with a Newcombe 95% interval.

## Primary analysis (one confirmatory comparison)

- **C1 pooled: cm vs full, acted-on over all 192 facts.** C1 holds if the lower bound of the
  95% interval of (cm - full) is above **-10 points**. Trials are the unit for resampling: bootstrap
  B = 10,000 over trials within each arm, paired by seed (the same seed gives both arms the same
  facts).
- Everything else is exploratory and reported with the word "exploratory": per-type differences,
  cm vs compact, written rates, failure classes.
- Leak rule (feeds the cornerman fix list, not a pass/fail): a type where cm is below full by 3 or
  more of 24 facts, or where cm's written rate is below 90%.

What n = 8 can show: at a pooled rate near 90% with 192 facts per arm, the half-width of the
difference is about 6 points if facts were independent; facts in one trial are not, so expect wider.
Per type (24 per arm) the half-width is about 15-20 points, so per-type results are descriptive.

## Predictions

| # | Prediction | Confidence |
|:--|:--|:--|
| P1 | full acted-on pooled >= 90% (the ceiling is high; 24 facts in one context are not too many) | 75% |
| P2 | C1 holds: cm - full lower bound above -10 points | 60% |
| P3 | compact is below full pooled by 5 or more points | 60% |
| P4 | cm is above compact pooled | 55% |
| P5 | cm's lowest type is reversed or open-question (late corrections and gates are the easiest to gloss) | 50% |
| P6 | cm written rate pooled >= 90% | 70% |
| P7 | at least one cm miss is "written but not acted on" (the round 4 pattern) | 70% |
| P8 | cm clearsInWork >= K in at least 7 of 8 trials at the frozen nudge | 70% |

## Notes

(None yet.)
