# Predictions for the first development trial (written 2026-11-20, before the trial)

The trial: seed 101, development set, Sonnet, W = 50 work turns of 6 files, arms full, compact
(window 100k) and cm (nudge at 68k), one container each. cornerman pinned to v0.7.3 (05caa81), which
is fea0cee plus the release commit and no change under `plugin/`.

This trial measures the rig. It decides nothing about the candidates, and no result here goes into
the decision rule. The predictions are here so the measurements can be read against what was
expected, not explained afterwards.

| # | Measure | Prediction | Based on |
|:--|:--|:--|:--|
| 1 | `--autocompact 1000000` gives the full arm a 1M window | Yes: no compaction below 900k | The CLI accepts 100k to 1M; not yet seen above 180k in this rig |
| 2 | Full arm context after the 50 work turns | 700k to 1.1M, so about an even chance it compacts and the work has to be trimmed | 10k to 20k per 6-file work turn in floor runs 1, 2 and 5, plus plants and fillers |
| 3 | Tokens added per work turn, full arm, median | 12k to 18k | The same three floor runs, n = 3, four turns each |
| 4 | Compact arm: context at each auto compaction | 64k to 70k every time | 66,250 to 68,315 in five runs (spike and four hybrid smokes) |
| 5 | Compact arm: compactions before the probes | 11 to 16 | About 60k of new context per cycle against 700k to 1M of work |
| 6 | Compact arm: context just after a compaction | 9k to 20k, rising through the trial | 8,761 in the spike with few planted messages; more user messages here |
| 7 | cm arm: handovers before the probes | Within 3 of the compact arm's compaction count | The nudge is set to the measured compaction point |
| 8 | cm arm: rules part reaches its 9,000-character budget | By the fourth load, and at least one class I rule is named as dropped before the probes | Stage A2: the budget filled by the third load with 24 facts; here 48 fillers are added |
| 9 | Hours per trial | Full 3 to 5, compact 2.5 to 4, cm 3 to 5 | Floor run 0: 19 minutes for plants and 4 work turns, 15 minutes for 28 probes |
| 10 | Invalid plants per arm | 0 or 1 of 28 | 1 invalid plant in 9 short floor runs |
| 11 | Split plants (a clear or compaction between the two messages of a C or E plant) | 0 in full; 0 to 2 in compact and cm | Six two-message plants against 11 to 16 events |

Not predicted: any acted-on score. One seed says nothing about the arms, and the trial is not read
for that.

If prediction 2 fails high (the full arm compacts), the fix is fewer files per work turn
(`--per-turn`), decided from the measured tokens per turn, and the trial is rerun for the full arm only.
