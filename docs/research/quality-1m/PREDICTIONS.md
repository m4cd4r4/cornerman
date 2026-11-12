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
- Per arm vs Default: bootstrap B = 10,000, 95% interval of the difference in late pass rate.
  Each draw resamples the late checkpoints once for both arms (so a checkpoint that is hard for
  everyone counts against both) and resamples runs within each arm. Runs are not paired across
  arms. (Reworded 2026-11-12: this is what `tools/compare.mjs` has always done; the earlier text
  "paired by checkpoint and run" was wrong about runs.)
- One confirmatory comparison: CM-250 vs Default on Sonnet. Every other arm, model and pair
  (Compact-250 vs CM-250 through `compare.mjs --base`, CM-180/350/500, Opus) is exploratory: it
  is reported with its interval and the word "exploratory", and it supports no headline claim.
- Claim rule: "clearing helps" only if the interval for CM-250 vs Default is above 0. Below 0:
  "clearing hurts". Spanning 0: "no large effect at n = 5", never "no effect". A bound of exactly
  0 spans 0: the interval must exclude 0.
- What n = 5 can show: with 49 late checkpoints and 5 runs per arm, at a late rate near 60% the
  interval's half-width is about 9 points if checkpoints were independent
  (1.96 x sqrt(2 x 0.6 x 0.4 / 245)). A true difference smaller than that will usually read as
  "no large effect". Recompute from the full-test data; do not quote this figure as a result.
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

What would make the test "not testable" (one rule since 2026-11-12, the one in TASK-DESIGN.md
"Late segment"): Default's late pass rate on Default pilot data is outside 40-80%. That sends the
task back for a retune before Stage 3, never a published comparison. The earlier wording here
(both arms >= 95% or <= 10%) was looser than TASK-DESIGN.md and read a CM result; it is withdrawn.

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
- 2026-11-12 (fix and retune after the pre-full-test audit; no paid run, no full-test run exists).
  Every change since the last freeze:
  - Specs (51e66df): 30 rule sentences added to 24 checkpoint specs. Each states a rule a hidden
    assertion already tested and the spec did not say (four spec audits, cp01-80). Each sentence
    was checked against the reference; no assertion was dropped. cp77 was not edited: overflow is
    stated at cp02 instead (`=10^400` is `Infinity`, no error).
  - Probes: `check-probes.mjs` keys git-files answers on the union of the cpNN commits up to the
    head the gate logged when the probe was answered (`--head`). Probe P2.9 reworded. P6 therefore
    means something slightly different from what was frozen on 2026-11-09.
  - House rules: moved from START-PROMPT.md to `harness/HOUSE-RULES.md`, printed by the gate with
    the first checkpoint only. The cornerman relay re-sends the start prompt every segment, so CM
    arms were being re-told the rules after each clear and Default was not. P5 changes meaning:
    rules are now given once to every arm. `score-run.mjs` also reports a distinct-violation count
    and, per probe, context size at ask and the kind of the last reset.
  - `compare.mjs`: `--base` for exploratory pairs and a Verdict column. Primary analysis wording
    above corrected (resampling, one confirmatory comparison, a bound of exactly 0 spans 0, one
    40-80% rule). Harness pins from f133cae (Claude Code and skills pinned, one run at a time, a CM
    usage limit it cannot wait out = INVALID).
  - Late hardening: 26 late checkpoints (cp35, 38, 39, 42-46, 48, 50-53, 56, 57, 60-64, 66, 68, 71,
    75, 77, 78) gained one `cpNNh recall` hidden test each: the new feature must obey a rule stated
    in cp01-31. 14 specs gained a pointer naming the early checkpoint. A separate reviewer, given
    the diff and the specs only, judged all 26 fair. 26 `recall-*` mutants added. Verified after:
    reference 727/727 hidden tests, full mutant run 605/605 killed, probe, score, compare and
    rule self-tests and the gate smoke all pass.
  - Evidence that came from CM pilot data, disclosed: duplicate cpNN commits (Default 6, CM 5, seen
    in both arms), the cp32 regression (both arms), the `eval` false hits (CM only, 2026-11-11
    note). The start-prompt re-send was found in the plugin source, not in run data.
  - Result of the retune, Default pilot data only (default-sonnet-r2, scored with the new hidden
    tests): late cp32-80 42/49, was 44/49. The two new failures (cp60, cp62 recall) rest on the
    cp13 sentence "`#REF!` comes first", which was added on 2026-11-12 and which the pilot run
    never saw, so they are not evidence that the tests bite. Of the 23 recall tests the pilot
    could fairly be scored on, it passes 23. Three older late failures (cp44, cp45, cp77) are on
    rules now stated in the specs. Best estimate for a fresh Default run: about 47/49 (96%).
  - Verdict under the "not testable" rule above: Default's late rate is outside 40-80% and fair
    hardening did not move it. The comparison as frozen is NOT run. Macdara chose (2026-11-12
    08:40 AWST) to stop hardening and reframe; the proposal is REFRAME-DRAFT.md, which is a draft
    and changes nothing here until he approves it. No prediction, threshold, claim rule or K
    changed in this note. K stays 32.
