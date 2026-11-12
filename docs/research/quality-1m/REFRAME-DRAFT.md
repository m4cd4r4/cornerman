# Reframe draft: "no worse and cheaper" (2026-11-12)

Status: DRAFT for Macdara. Nothing here is frozen. PREDICTIONS.md stays as it is until he approves
a version of this. No paid run is planned by this file.

## Why the frozen test cannot run as written

The frozen rule (TASK-DESIGN.md, "Late segment") says the comparison is only run when Default's
late pass rate on Default pilot data is inside 40-80%. It is not, and fair hardening did not move it.

- Pilot 2, Default, late segment cp32-80: 44/49 (90%).
- Three of those five failures (cp44, cp45, cp77) were on rules the specs did not state. Step 1
  (51e66df) wrote those rules into the specs, so a fresh Default run would probably pass them:
  about 47/49 (96%). This is an estimate. No Default run on the fixed specs exists.
- Step 2 added 26 "recall" hidden tests to late checkpoints, each testing that a new feature obeys
  a rule stated in checkpoints 1-31. A separate reviewer judged all 26 fair. On the Default pilot
  run, 24 pass. The two that fail (cp60, cp62) rest on a cp13 sentence that step 1 added, which the
  pilot run never saw, so they are not evidence. Valid hits: 0 of 23 (cp57 excluded for the same
  reason).
- So Default at 959k context, after one compaction, kept following rules it read once, early.
  The task is at the ceiling for Default and fair tests do not change that.

Both pilots (40 and 80 checkpoints) gave the two arms the same late pass rate at n = 1.

## Proposed primary: two claims, both on Sonnet, CM-250 vs Default

1. **Quality is no worse.** Metric and bootstrap as frozen (late pass rate cp32-80, B = 10,000,
   95% interval of CM-250 minus Default). Claim "no worse" only if the lower bound is above
   -5 points. Lower bound at or below -5: "not shown to be no worse". Upper bound below 0:
   "clearing hurts".
2. **Cost is lower.** API-equivalent cost per run, ratio CM-250 / Default, bootstrap over runs,
   95% interval. Claim "cheaper" only if the upper bound is below 1. Pilot 2, n = 1 per arm:
   US$20.01 / US$37.38 = 0.54.

The headline would be: "clearing at 250k was no worse on late-task quality and cost X% less".
It would never be "clearing improves quality".

## What this design cannot show (say so in any write-up)

- **A ceiling task is weak at detecting harm.** At a 95% pass rate with 49 late checkpoints and
  5 runs per arm, the interval half-width is about 4 points if checkpoints were independent
  (1.96 x sqrt(2 x 0.95 x 0.05 / 245)). They are not independent, so expect wider. "No worse
  within 5 points" is close to the most this task can support.
- **Recall probes went the other way in the pilot.** Default 49/50, CM-250 42/50 (n = 1, and the
  probe key was unfair to CM in ways step 1 fixed). Probes stay a reported secondary. If CM-250
  is again lower on probes, the write-up says clearing lost some recall while hidden-test quality
  held.
- The margin of 5 points is a judgement, not a derived number.

## Decisions for Macdara

1. Approve, change or reject the two claims and the 5-point margin.
2. Arms: this draft runs Default and CM-250 only, on Sonnet. That reverses the 2026-11-09 ruling
   of 6 arms on both models. CM-180/350/500, Compact-250 and Opus would be dropped or run later
   as exploratory.
3. Spend: 5 runs per arm at pilot 2 prices is about 5 x US$37.38 + 5 x US$20.01 = US$287
   API-equivalent, and the pilot pair used one whole 5-hour usage window (Default waited 10
   times). Needs a yes on the figure before any run.
4. Step 3 of the old plan (Compact-250 smoke, one pinned Default + CM-250 pair with a forced
   usage limit) is paid and still needs its own yes.
