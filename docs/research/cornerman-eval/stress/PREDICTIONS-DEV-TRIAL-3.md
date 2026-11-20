# Predictions for the third development trial (written 2026-11-20, before the trial)

The trial: seed 102, development set, Sonnet, W = 50 work turns of 2 files (`--per-turn 2`), all five
arms side by side, one container each: full, compact (window 100k), hybrid (window 100k plus the
`rig/hybrid` hooks), cm (nudge at 68k) and floor (`/clear` after any whole step that ends at or above
68k). Rig at commit 42c66d6 or later. cm and hybrid pin `CM_REF=5d20b58` (cornerman PR #220, fix
candidate 9, on top of 0.7.3; the hybrid uses only its lib, which is 0.7.3's).

What changed since trial 2 (STRESS-TEST-DESIGN.md, "Applied 2026-11-20"):

- The driver flags a plant acted on at plant time (`actedAtPlant`) and leaves its probe out of scoring.
- D-ruling-A is probed fourth, straight after the three H probes.
- cornerman's handover skill files a job's "stop there" under State with the job, not under Do not.
- First long trial of the hybrid and floor arms.

Seed 102 draws the same A-path-A variant (`deploy/ledger.config.json`), the same A-ruling-C variant
(`feeAt`, basis points) and the same D-ruling-A variant (round down) as seed 101, so the D-ruling-A
change is tested on the case that showed the fault.

This trial measures the rig and fix 9. It decides nothing about the candidates, and no result here goes
into the decision rule.

| # | Measure | Prediction | Based on |
|:--|:--|:--|:--|
| 1 | Reads of a reading file with a limit or offset | 0 to 5 in every arm | Trial 2: 0, 0, 0 |
| 2 | Full arm | No compaction; context after the 50 work turns 560k to 700k; peak below 800k | Trial 2: 654k, peak 726k |
| 3 | Compact arm: compactions before the probes | 15 to 23 | Trial 2: 19 |
| 4 | Hybrid arm: compactions before the probes | Within 3 of the compact arm's count | Same window and work; the hooks add 2k to 6k after each compaction (smokes) |
| 5 | Hybrid arm: context just after a compaction, median | 1k to 7k above the compact arm's median | Smokes: 10,991 to 14,427 against the spike's 8,761 |
| 6 | cm arm: handovers before the probes | 11 to 17, fewer than the compact arm's compactions | Trial 2: 14 against 19 |
| 7 | Floor arm: clears typed before the probes | 12 to 24 | No long floor run yet; a cleared session starts lower than a compacted one but carries nothing |
| 8 | **Fix 9: cm handovers that put an in-flight job's stop ("step N", "stop") under Do not** | 0 | Trial 2: every handover after the first F plant did |
| 9 | **Fix 9: cm in-flight probes (class F) acted on** | 2 or 3 of 3 | Trial 2: 0 of 3, all asked which step while knowing the state |
| 10 | D-ruling-A leak flag | Empty in every arm (nothing before the fourth probe writes `src/money.js`) | Trial 2: `src/money.js` in every arm |
| 11 | D-ruling-A in the floor arm | Violated (nearest, from the fixture's `round2`) | Floor variant checks: 0 passes |
| 12 | Facts acted on at plant time | 0 to 3 per arm; if any, class I | Trial 2: cm built the 3 class I stubs in session 1 |
| 13 | Floor arm acted on | 0 to 4 of 28 | Floor confirmation runs: 0 of 83 |
| 14 | Hours, first message to last probe | Full, compact, cm 1.2 to 2.0; hybrid 1.3 to 2.2; floor 1.0 to 2.0 | Trial 2: 1.3, 1.5, 1.4, three at once; five at once on 6 CPUs may slow each |
| 15 | Cost in input-token equivalents | Full 13M to 20M; compact 3M to 5M; cm 3.5M to 6M; hybrid within 25% of compact; floor 2.5M to 5M | Trial 2: 16.2M, 3.9M, 4.8M |
| 16 | Invalid plants per arm; split plants | 0 or 1 invalid; split 0 in full and floor, 0 to 2 in the others | Trial 2: 0 and 0 everywhere |

Not predicted: the acted-on scores of full, compact, hybrid and cm. One seed says nothing about the arms.

Where I expect to be wrong: prediction 9 (the agent may still ask on "Carry on" for a reason other than
the Do not line, as A-path-A in trial 2 asked while it knew the answer); prediction 7 (no long floor run
yet); prediction 14 (five containers at once).

If prediction 8 fails, fix 9 did not reach the writer, and prediction 9 is not read as a test of it. If
prediction 10 fails, D-ruling-A goes out of the pooled score instead.
