# Predictions for the second development trial (written 2026-11-20, before the trial)

The trial: seed 101, development set, Sonnet, W = 50 work turns of 2 files (`--per-turn 2`), arms full,
compact (window 100k) and cm (nudge at 68k), one container each, cornerman v0.7.3. It is a rerun of
trial 1 with three changes: the work-turn task says to read each file whole, the driver lists reads of a
reading file that carry a limit or offset (`limitedReads`), and development filler 42 ("read all of it
anyway") is replaced by a rule about version numbers.

Why: in trial 1 the full and cm agents read the first 60 lines of each file and the compact agent read
every file whole, so the arms did unequal work (STRESS-TEST-DESIGN.md, "First development trial").

This trial measures the rig. It decides nothing about the candidates, and no result here goes into the
decision rule.

| # | Measure | Prediction | Based on |
|:--|:--|:--|:--|
| 1 | Reads of a reading file with a limit or offset | 0 to 5 of about 100 in every arm | The task now says so; trial 1's compact arm read whole files unasked |
| 2 | Tokens added per work turn, full arm, median | 10k to 13k | Trial 1 compact arm: 5.1k to 6.7k per whole file |
| 3 | Full arm context after the 50 work turns | 560k to 680k, peak below 800k, no compaction | 20k at the first work turn plus 50 turns of prediction 2 plus fillers; trial 1's probes added 78k |
| 4 | Compact arm: compactions before the probes | 10 to 16 | About 52k of new context per cycle (68k down to 16k) against about 600k of work |
| 5 | Compact arm: context at each compaction | 66k to 78k every time, median 68k to 70k | Trial 1: 66.0k to 77.5k, median 68.9k, n = 58 |
| 6 | Compact arm: context just after a compaction | 9k to 21k in at least 8 of 10, no rise through the trial | Trial 1: 49 of 58 in 9k to 20k, no rise |
| 7 | cm arm: handovers before the probes | 11 to 16, and 0 to 4 more than the compact arm's compactions | A new cm session starts near 25k, so a cycle is about 43k against compact's 52k |
| 8 | cm arm: rules part at its 9,000-character budget | From the second or third load; the three class I rules out of the rules part in every load after that; every handover body restates them | Trial 1: at budget from the second load, restated in 14 of 14 handovers |
| 9 | Hours per trial, first message to last probe | Full 1.2 to 2.0, compact 1.2 to 2.0, cm 1.3 to 2.2 | Trial 1: 1.3, 2.4 (58 compactions of 27 to 60 seconds), 1.5 |
| 10 | Cost in input-token equivalents | Full 14M to 22M; compact and cm each 25% to 45% of full; cm within 25% of compact | Trial 1: 17.6M, 7.9M, 5.9M on unequal work |
| 11 | Invalid plants per arm | 0 or 1 of 28 | Trial 1: 0, 0, 0 |
| 12 | Split plants | 0 in full; 0 to 2 in compact and cm | Trial 1: 0, 0, 0 |

Not predicted: any acted-on score. One seed says nothing about the arms.

Where I expect to be wrong: prediction 1 (an agent may still cut a long file, and then the arms differ
again, by less); prediction 7 (the cm cycle length is one trial's reading of where a new session starts).

If prediction 3 fails high (the full arm compacts), the trial is rerun for the full arm at 1 file a turn
with more work turns. If prediction 1 fails by more than 5 reads in any arm, the comparison of event
counts in prediction 7 is not read.
