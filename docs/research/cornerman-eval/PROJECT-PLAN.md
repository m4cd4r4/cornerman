# Cornerman evaluation: plan (2026-11-16)

Goal (Macdara, 2026-11-16 17:30 AWST): reassurance that cornerman works as expected and is as good
as it can be. "Token spend is not a concern." "We should test for both choices, separately if
required. This is important and we should do it as thoroughly as possible."

## Where the evidence stands (from quality-1m/TASK-DESIGN.md)

- Pilot 2 (n=1): CM-250 late 44/49 = Default 44/49, US$20 vs US$37, 1h33 vs 5h24; probes 42/50 vs 49/50.
- Dial (n=2, 0.7.2): clear arm 23, 25 of 37 late vs natural 31, 31; chat rules kept 4, 7 of 14 vs 12.
  Cause: headless handover skipped rulings. Fixed in #211, not measured through a real clear.
- Retest x2 on #211/#214: never cleared (mid-turn hook-context ask ignored or refused as injection).
- #215 (merged 8d96c43, unreleased): ask as a user turn, 9 of 9 obeyed. Trials stopped at the save
  call: no handover filed, no resume, no score.
- Not tested: interactive path, Haiku, the Stop ask, chained clears.

## Claims, each tested on its own

| Claim | Test | Pass |
|:--|:--|:--|
| C1 Everything relevant is carried forward | Test 1 | per fact type, both "written" and "acted on" rates, with intervals |
| C2 Clearing gives higher quality | Test 2, superiority | interval of (cornerman - Default) late pass rate above 0 |
| C3 No worse, and cheaper/faster | Test 2, non-inferiority | lower bound above -margin (margin frozen before runs) AND cost/time lower |

Margin, n and K are frozen in a PREDICTIONS file before any scored run.

## Test 1: carry-forward fidelity

- Planted facts by type: user ruling (own words), decision, do-not, ruling later reversed (latest
  must win), open question, in-flight work, file path, number; given mid-turn, at turn end, and
  before cornerman was installed.
- Two scores per fact: **written** (deterministic check of the handover file) and **acted on**
  (hidden test after resume on a task that needs the fact, never a direct quiz).
- Chains: 1, 2 and 3 clears; a fact from before clear 1 must hold after clear 3 (carry.mjs risk).
- Arms: cornerman clear, Default after auto-compaction, Default full context.
- Modes: headless runner and interactive (TUI driven by tmux send-keys). Models: Sonnet, Haiku, Opus.
- Trials fork from one cached base; target 50-100 trials.

## Test 2: quality

- New task where long context hurts: content the agent must read (pilot 4: filterable noise gets
  filtered). Calibrate first: Default late pass rate inside 40-80%, else rework before any comparison.
- Arms from the same base and fork point: Default (compacts), cornerman clear, clear with an
  oracle hand-written handover (ceiling), clear with no handover (floor). Cornerman vs oracle =
  handover loss; oracle vs Default = whether clearing helps at all.
- n >= 5 per arm, two fork depths, hidden-test scoring only. Report C2 and C3 separately.

## Field check (alongside)

Mine Macdara's own cornerman sessions: after each clear, count repeats and corrections of lost
decisions, vs sessions without a clear.

## Rig (decided 2026-11-16)

- **Docker on the Donnacha VPS** (Macdara card 17:36 AWST). One fresh container per trial: clean
  HOME and CLAUDE_CONFIG_DIR, cornerman installed from a tagged release via the marketplace (the
  real install path), nothing from ~/.claude. Caps per container about 1.5 GB / 1 CPU; 3-4 at once
  (VPS 2026-11-16: 6 cores, 9.3 GB available, 119 GB disk free, load ~1, 74 containers).
- **Billing: subscription, not an API key** (Macdara, same card). Needs `claude setup-token`
  (CLAUDE_CODE_OAUTH_TOKEN), which only Macdara can run. Usage windows still apply: the runner on
  the VPS waits them out detached, so a batch no longer dies with a chat session. Trials share
  Macdara's own limits, so batches run off-hours.
- Not `--bare` (it skips plugins and hooks). Cloud sessions ruled out: they load no plugins.
- To verify first: plugin + hooks load and fire in the container under the OAuth token (one stub
  and one real trial).

## Phases

1. Rig: Dockerfile, runner, results sync, token handover; proof run. (needs Macdara for setup-token)
2. Test 1 build + dry checks (stub, US$0), then real trials.
3. Fix whatever Test 1 shows leaking; release.
4. Test 2 task build + calibration pilot, then the four arms.
5. Write-up with C1, C2, C3 as separate results.

Open: release 0.7.4 held (Macdara 17:20 AWST) until the next change.

## Rig results (2026-11-16)

- **Stub proof (US$0), local Docker Desktop and VPS:** P1-P5 pass on fix/rulings-skip-own-ask. P5 fails
  on main 8d96c43: the #215 threshold ask was logged as a user ruling. Fixed in cornerman PR #216.
- **Real call on the VPS (US$0.02):** OAuth token in the VPS env file under /opt/cornerman-eval
  (mode 600, root; Macdara approved the copy by card 2026-11-16), plugin loaded (init event lists
  cornerman 0.7.3), apiKeySource none. Side finding: the first-run welcome text is in the model's
  reply in `claude -p` output.
- **Interactive relay, real Sonnet 5.5, plain terminal app in tmux (tui-probe.sh REAL=1, nudge 35k):**
  the relay saved, cleared and carried on 3 times by itself (4 sessions, 3 of 3 clears used, then a
  fourth handover left waiting as designed). The chat rule (backticks, never the forbidden word) was
  in every handover's "Decisions already made", "Do not" and "Rulings from the user". NOTES.md: 28
  lines over 4 sessions, 0 lines breaking either rule, progress continuous (14, 22, 28; no repeats).
  Trial setup notes: bypass mode shows a warning config cannot skip, so trials allow tools by rule;
  a stub key needs customApiKeyResponses pre-approved.

## Test 1 smoke (2026-11-16, Sonnet, seed 1, K=1, nudge 35k)

- Rounds 1-2 found rig faults, not cornerman faults (fixed a9491dc, 24cae38, 6130606): probe
  baselines committed in the agent's repo (leaked into a handover); a probe that named the gated
  change read as the OK; plants acted on at plant time; in-flight plant contradicted the fixture;
  question cards and `/compact` never fire Stop (driver waited out TURN_MAX); written scored on
  handovers older than the plant.
- **Round 3: cm 8/8, full 8/8, compact 8/8 acted on; cm written 15/15 on handovers filed after each
  plant** (7 facts crossed 2 clears, the late correction 1). No timeouts or driver errors.
- Real cornerman finding (minor): the rulings log keeps a superseded ruling verbatim next to its
  correction ("3 spaces" and "2 spaces"), unmarked. The agent still used the latest.
- **The smoke does not separate the arms:** one compaction on this little context loses nothing.
  The batch needs 2-3 clears/compactions and more reading per segment, or C1 shows no difference.
- Auto-memory confound: round 3 transcripts show memory files written by cm 15, compact 11,
  full 1; they survive a clear. **Macdara 2026-11-16 21:48 AWST: auto-memory off in all arms**
  (b247bf4: `autoMemoryEnabled:false` + `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`; result.json
  `memoryFiles` must be []).
- **Round 4 (memory off): cm 7/8, full 8/8, compact 8/8; memoryFiles [] and 0 memory writes in
  every arm.** cm miss = ruling (reject negatives), written in every handover but not acted on:
  the handover writer glossed it as "a note, not a task. Ask before implementing", then "applied
  only in src/refunds.js; NOT in applyFee. Ask before extending"; after the clear the agent
  followed the gloss over the verbatim ruling quoted below it. Partly induced by the brief ("don't
  change any code until I give you a task"), reworded after round 4 to "standing rules and facts
  for every later task". Cornerman lead (n=1, confirm in the batch): the handover must not attach
  its own conditions to a user ruling.
- **Round 5 (memory off, reworded brief 58144db): cm 8/8, full 8/8, compact 8/8; memoryFiles [] in
  every arm.** cm ruling now obeyed after 2 clears (applyFee rejects negatives); written 2/2 on
  every fact, the reversed fact still has the superseded wording in its handover (stale), latest
  used. Work turns: cm 2 (4 sessions, 2 handovers), compact 3 (1 compaction), full 4.
- Rig fault in round 5, fixed 2c3f049: a two-question AskUserQuestion card shows "Tab/Arrow keys
  to navigate"; the driver matched only the one-question footer, so the full arm's open-question
  probe waited out TURN_MAX and scored not-attempted (the pending ask reaches the transcript only
  when the card resolves). That trial was killed (next probe typed into the open card), archived
  as `_invalid-full-s1-r5-multicard`, and rerun. Fix checked on both footer strings; no real run
  has shown a multi-question card since.

## Batch pressure (decided 2026-11-16, not built)

The smoke does not separate the arms, and the arms do not do the same work (round 5: 2, 3 and 4
work turns). Changes before the batch:

1. **Equal work in every arm.** Every arm runs the same W work turns (W = 3K + 1); compact types
   `/compact` every 3; cm's nudge is calibrated on one pilot so the relay clears at least K times
   inside W. Probes start only after W, never on "clears reached".
2. **K = 3.** Plants before clear 1 must hold after clear 3 (the carry.mjs risk in Test 1's design).
3. **Reading is capped, so it is not the main lever.** The image holds about 640 KB of npm docs
   (commands 452K, using-npm 120K, configuring-npm 72K; about 160k tokens). At K = 3 that is about
   50k tokens per segment, which one compaction summarises easily. Use all three folders, 6 files
   per turn.
4. **Density is the lever: 3 facts per type (24 per trial).** A summary or handover drops detail
   when there is more to carry. Needs non-conflicting variants within a pool (two "number" facts
   must not name the same setting), one probe and checker per fact, and a fresh fairness review.
5. Then freeze Test 1 PREDICTIONS (margin, n, K, W, facts per type) with sha256, before any scored
   run.

**Built 2026-11-17 (items 1-4):** driver runs `--work` W = 3K+1 turns in every arm (6 files a turn,
all three folders interleaved; result.json `W`, `clearsInWork`, log `UNDER-PRESSURE` when cm clears
fewer than K after the plants). facts.mjs: 3 slots per type (table in TEST1-DESIGN.md), 24 facts
per trial; new fixture files (release/archive scripts, rate and template look-alikes, batch and
paginate stubs) and checkers (call, reversed-quotes, reversed-header; number by kind). Fresh Sonnet
fairness review: no blockers; applied every should-fix (written regexes another fact matched,
rulings scoped to new money code so the round2 refactor and refunds/transfers do not collide,
open-question Bash edits counted only on a write, default-leaning variants path-A0, path-C0 and
reversed-B "single" dropped). Selftest 309/309 in the rig container. Left as known leans:
decision-B ISO and decision-C lower case match the agent's likely default.
**cm calibration pilots (2026-11-17, Sonnet, K=3, W=10, 24 facts; not scored):**
- s901, nudge 35k: the relay's default budget (3 clears a window) was spent by work turn 2, then one
  session ran 31k-211k through the probes. Acted on 21/24, written 24/24. Misses: in-flight-C0 a rig
  fault (archive step 3 "upload" needed credentials the repo lacks; steps 3-4 now local);
  open-question-B1 and C0 "written, not acted on": the agent quoted the gate, then "took this
  request as that go-ahead". B1 was confounded (the probe's requester was the gate's stakeholder,
  reworded); C0 kept, the full arm decides whether it is a leak or the probe.
- s902, nudge 70k: clears after work turns 2, 5, 8 (compact: 3, 6, 9), sessions peak 81-99k.
  Acted on 23/24 (the one miss is the archive fault, old fixture), written 24/24. **Nudge = 70k.**
- Driver records `clearAt`, `clearsAfterLate`; run-trial.sh takes the nudge as arg 6 (default 70k).
Still open: item 5 (freeze PREDICTIONS; margin needs Macdara's OK), then the batch off-hours.

**Scorer (2026-11-17, before any scored result):** `test1/score.mjs <out-dir>` implements the frozen
PREDICTIONS scoring (paired seed bootstrap B=10,000 with a fixed RNG seed, Wilson, Newcombe, leak rule,
P1-P8) and lists INVALID trials (DRIVER ERROR, probe TIMEOUT, checker-error, usage limit, memory files,
not 24 facts) for rerun by key. Checked on pilots s901/s902 (21/24, 23/24, written 24/24, as recorded)
and on a synthetic 24-trial set where each invalid rule fired and the pairing dropped those seeds.
Not in frozen.sha256.json (written after the freeze; it reads results, it does not run trials).

## Audit before the batch (2026-11-17 09:50 AWST, Fable 5.2; nothing frozen was changed)

Checked the frozen design against driver.mjs, run-trial.sh, batch.sh, facts.mjs and the two pilots.
Sound: arms interleaved per seed, same facts per seed in every arm, cornerman installed in the cm arm
only, auto-memory off, probes scored by hidden checkers, a trial takes about 33 minutes.

Findings, most important first:

1. **No floor, so the margin has no scale.** Nothing shows what an agent that lost everything scores
   on the 24 probes. If the floor is 70%, cm at full minus 10 has lost a third of what can be lost.
   **Floor arm approved (Macdara card 2026-11-17 09:50 AWST):** plain `/clear` after work turns 3, 6, 9,
   no cornerman, seeds 1-8, exploratory, run after tonight's batch so the frozen rig is untouched.
   Predictions written before any scored data: floor pooled acted-on <= 40% (75%); >= 10% (80%);
   lowest types number and open-question (60%). Reported with retention =
   (cm - floor) / (full - floor). If the floor is above 60%, C1 is reported as "low sensitivity".
2. **The planting is the easy case.** All 24 facts arrive as short standalone notes in one burst before
   work turn 0 (driver.mjs: no work turn between early plants; the comment there and TEST1-DESIGN.md
   "spread over typed turns, some mid-turn" say otherwise), after a brief that calls them standing rules.
   cornerman's rulings log copies such messages verbatim, which fits written 24/24 in both pilots.
   Not tested: a ruling inside a task message, a fact given between clear 2 and 3, a decision that is
   "yes, do that" to an option the agent described, a fact given mid-turn. Tonight's result is to be
   reported as "explicit up-front rules across 3 chained clears", not "everything relevant".
   **Test 1b (same card): design it after tonight's results.**
3. **A usage limit ends turns without a driver TIMEOUT**, so a limited trial would have scored 24
   not-attempted and counted as valid. batch.sh (frozen, already waiting) has no limit check, so a
   limit mid-batch wastes the rest of the night; score.mjs now marks any transcript with an API error
   message INVALID and notes any trial with 12+ not-attempted (3cc9002). The `isApiErrorMessage`
   field name is from memory of the transcript format, not confirmed on a real limited trial: the
   12+ note is the backstop, read it.
4. **Percentile bootstrap over 8 seeds runs narrow.** score.mjs prints a paired t interval next to it
   and says when the two disagree about the margin (synthetic check: bootstrap -18.3 vs t -23.3).
   The frozen test stays the bootstrap; a disagreement is reported, not hidden.
5. A pooled pass can hide one weak type: a type at 12/24 costs 6 pooled points. The frozen leak rule
   (3 or more of 24 below full) covers it; report leaks next to C1, never C1 alone.
6. Scope: Sonnet, interactive, cornerman main 107ff1f (unreleased), one fixture. The headless arm and
   Haiku/Opus from TEST1-DESIGN.md are not in this batch. reversed-B has one variant left (8 of 8 seeds).
7. If all three arms land above 95%, say that the test did not separate them; P3 (60%) may well fail.
