# Stage A predictions: cm rerun on seeds 1-8 after the five fixes

Written by Claude (Fable 5.2) on 2026-11-18, about 21:30 AWST, before any stage A trial ran. Run
approved by Macdara (card, 2026-11-18 21:15 AWST). `PREDICTIONS.md` is frozen and unchanged.

## What stage A is, and is not

- A **regression check**. The five fixes (PR #217, merged 2026-11-18 17:05 AWST) were diagnosed from
  the transcripts of these same eight seeds, so a good result here is expected and proves little.
- It cannot support the carry-forward claim. Only stage B (fresh seeds, the stress test) can. Release
  0.7.4 waits for stage B whatever stage A shows.
- A bad result is informative: the fixes do not do what their tests say, or they broke something.

## Fixed design

- Same rig, driver, facts, fixture, checkers and scorer as Test 1 (the frozen files, unchanged).
  Seeds 1-8, K = 3, W = 10, Sonnet, nudge 70,000, auto-memory off, CLI 2.1.316.
- One change: cornerman pinned to sha 474f66b988e32dbbf78b5f6c5775f93d97744ab8 (main after PR #217),
  where Test 1 used 107ff1f.
- Only the cm arm is rerun. It is compared with the Test 1 full, compact and floor arms. Those ran on
  2026-11-17 and 18 with the same seeds and facts; the comparison is across days, which is a limit.
- Results go to a separate folder (`out/test1-stage-a`). The Test 1 cm trials are kept.
- Validity: the frozen rules in `PREDICTIONS.md`. An INVALID trial is kept, excluded and rerun by key.

## Known limit carried over from Test 1

The in-flight slot A step-4 probe ("Carry on with the migration script") does not fully specify the
step. In Test 1, seeds 2 and 8 knew the fact and asked for the missing spec, which the checker scores
as not-attempted. No fix addresses this, because it is a fault in the probe. The rig stays frozen, so
those two are expected to miss again.

## Baseline (Test 1, cornerman at 107ff1f)

| | s1 | s2 | s3 | s4 | s5 | s6 | s7 | s8 | pooled |
|:--|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| cm | 24 | 22 | 17 | 23 | 23 | 24 | 3 | 23 | 159/192 (82.8%) |
| full | 22 | 23 | 22 | 23 | 24 | 24 | 24 | 22 | 184/192 (95.8%) |

cm by type, of 24: ruling 20, decision 24, do-not 21, reversed 21, open-question 19, in-flight 14,
path 20, number 20. Slot A step-4 probe: 0 of 6 (seeds 2, 3, 4, 5, 7, 8).

## Pass rule for the regression check

Stage A **passes** if all three hold:

1. cm pooled is at or above the baseline 159/192.
2. No type falls 3 or more of 24 below its baseline count.
3. No seed that scored 22 or more falls below 20.

A pass means "the fixes did not regress these seeds". A fail sends the fixes back before stage B.

## Predictions

| # | Prediction | Confidence |
|:--|:--|:--|
| A1 | The pass rule holds | 80% |
| A2 | cm pooled is 173/192 (90%) or more | 70% |
| A3 | Seed 7 scores 20/24 or more (was 3; fixes 1, 3 and 4 target it) | 65% |
| A4 | Seed 3 scores 20/24 or more (was 17; fix 4 targets it) | 55% |
| A5 | No seed is below 18/24 | 60% |
| A6 | Slot A step-4 probe: 2 or more of 6 obeyed (was 0; fix 5 targets seeds 4 and 5) | 55% |
| A7 | Seeds 2 and 8 miss the step-4 probe again by asking (the probe fault) | 60% |
| A8 | No probe turn ends with the agent saving a handover and asking for /clear with the task undone | 70% |
| A9 | In the final session of every trial, no superseded ruling appears unmarked next to its correction (was 24 of 24 reversed facts) | 65% |
| A10 | cm - full, paired seed bootstrap, 95% lower bound above -10 points (exploratory: tuned seeds, full arm from another day) | 60% |
| A11 | clearsInWork is 3 or more in at least 7 of 8 trials (was 7 of 8) | 70% |
| A12 | cm median token cost per trial stays at or below 60% of full (was 53%; the log now keeps more) | 70% |

A8 and A9 are read from the transcripts and the saved cornerman store, by script where a pattern
exists and by eye otherwise; the method used is stated with the result.

## Where I expect to be wrong

- The relay and the handover writer are not deterministic. Seed 7's collapse came from one bad third
  handover; a different seed can collapse the same way on a rerun, and a fixed seed 7 can be luck.
- A larger rulings log changes what the final session reads first. It can crowd out the handover.
- Fix 5 removes the mid-turn ask when no clear is left, so the last session can run longer than in
  Test 1. That raises cost (A12) and can bring in native auto-compaction, which the scorer flags.
