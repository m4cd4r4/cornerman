# Stage A2 predictions: cm rerun on seeds 1-8 after the context-cap fixes

Written by Claude (Fable 5.2) on 2026-11-19, about 10:55 AWST, before any stage A2 trial ran. Run
approved by Macdara (2026-11-19 about 10:49 AWST: "218 is now merged - Please proceed as you
recommend"). `PREDICTIONS.md` and `PREDICTIONS-STAGE-A.md` are unchanged.

## What stage A2 is, and is not

- A **regression check** of PR #218 (merged 2026-11-19 10:47 AWST), which fixes stage A faults 6, 7
  and 8: the session-start context cut, the turn-end ask with no relay clear left, and the partial
  replaced marks.
- The fixes were diagnosed from these same eight seeds, so a good result is expected and proves
  little. It cannot support the carry-forward claim. Only stage B (fresh seeds, the stress test) can.
  Release 0.7.4 waits for stage B whatever stage A2 shows.
- It is also the first check of the context split in the terminal app after `/clear`. The fix
  session's sandbox check ran headless only.

## Fixed design

- Same rig, driver, facts, fixture, checkers and scorer as Test 1 and stage A (the frozen files).
  Seeds 1-8, K = 3, W = 10, Sonnet, nudge 70,000, auto-memory off, CLI 2.1.316.
- One change: cornerman pinned to sha fea0ceeeef316c6574f27755de75833261f86138 (main after PR #218),
  where stage A used 474f66b.
- Only the cm arm is rerun. It is compared with the Test 1 full, compact and floor arms (2026-11-17
  and 18) and with stage A cm (2026-11-18). The comparison is across days, which is a limit.
- Results go to a separate folder (`out/test1-stage-a2`). Earlier cm trials are kept.
- Validity: the frozen rules in `PREDICTIONS.md`. An INVALID trial is kept, excluded and rerun by key.

## Baseline (stage A, cornerman at 474f66b)

| | s1 | s2 | s3 | s4 | s5 | s6 | s7 | s8 | pooled |
|:--|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| cm stage A | 24 | 22 | 23 | 24 | 24 | 24 | 22 | 22 | 185/192 (96.4%) |
| full (Test 1) | 22 | 23 | 22 | 23 | 24 | 24 | 24 | 22 | 184/192 (95.8%) |

- By type, of 24: in-flight 18, open-question 23, the other six 24.
- The 7 misses: 5 in-flight probes where the agent named the right step and asked for the missing
  spec (the probe fault; seeds 2, 7, 8), and 2 that every arm also missed (s2 in-flight-C0, s3
  open-question-A4). None of these is addressed by PR #218, and the rig stays frozen.
- Context cut in 23 of 24 loads; the agent opened the full copy in 20 of those 23.
- Final session of 8 of 8 trials saved a fourth handover and asked for a /clear nothing could run.
- Replaced marks missing for 5 of 24 reversed facts (the old indent rule, seeds 1 to 5).
- Cost: median 1.80M input-equivalents per trial, 53% of full.

## Pass rule for the regression check

Stage A2 **passes** if all four hold:

1. cm pooled is 179/192 or more (stage A minus 6: one quarter of a trial of run-to-run noise).
2. No type falls 3 or more of 24 below its stage A count.
3. No seed falls below 20.
4. No cornerman session-start context is cut ("Output too large") in any of the 24 loads.

A pass means "the fixes did what they say on these seeds and broke nothing". A fail sends the fixes
back before the stress test build.

## Predictions

| # | Prediction | Confidence |
|:--|:--|:--|
| B1 | The pass rule holds | 75% |
| B2 | cm pooled is 183/192 or more | 60% |
| B3 | Context cut in 0 of 24 loads (was 23) | 85% |
| B4 | Every cornerman session-start output is 9,000 characters or fewer | 85% |
| B5 | Both parts reach the model in every load that was split (no part 2 missing) | 75% |
| B6 | At least 8 of 24 loads name something left out, with the path of the full copy | 55% |
| B7 | The agent opens the full loaded copy in 8 or fewer of 24 loads (was 20 of 23) | 55% |
| B8 | No final session saves a fourth handover or asks for /clear (was 8 of 8) | 80% |
| B9 | Replaced marks missing for 0 of 24 reversed facts in the final loaded copy (was 5) | 65% |
| B10 | At least 3 of the 5 probe-fault in-flight misses recur (seeds 2, 7, 8) | 65% |
| B11 | clearsInWork is 3 in at least 7 of 8 trials (was 8 of 8) | 75% |
| B12 | cm median token cost per trial stays at or below 60% of full (was 53%) | 75% |
| B13 | All 8 trials are valid on the first run | 80% |

B3 to B9 are read from the transcripts and the saved cornerman store by script
(`stage-a-context-cut.mjs`, `stage-a-stale.mjs`, extended where the two-output form needs it) and by
eye where a pattern is too strict; the method used is stated with the result.

## Where I expect to be wrong

- The split is new code on the session-start path. A part 2 that arrives late or not at all (the
  spool wait, the 20 second hook timeout on a 1 CPU container) would hide the standing rules, which is
  worse than the cut, because the cut left a file path. That is what B5 watches.
- The shrink order drops state detail first. Stage A agents mostly read the whole copy from the file;
  now they get a shortened state and may not open the copy. In-flight and open-question facts live in
  that state, so those two types are where a fall would show.
- The wider correction matching in fault 8 can mark a ruling as replaced when it is still live.
  Ruling and do-not types are where that would show.
- With no turn-end ask in the final session, that session runs on to the end with a growing context.
  Cost can rise, and native auto-compaction can appear, which the scorer flags.
