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

**Applied 2026-11-17 10:30 AWST (Macdara card):** finding 3's gap is closed in batch.sh by a stall guard
(stops launches after a trial that finished in under 10 minutes or has 12+ probes not-attempted; 4 cases
checked), with dated notes in PREDICTIONS.md and a re-freeze on pilot data only (3c029ee). Rig re-synced
to the VPS, batch.sh and PREDICTIONS.md hashes match the manifest there; driver.mjs and facts.mjs carry
CRLF on disk, as in the pilots, and match once LF-normalised. Old waiter killed; new waiter pid 2194487,
same start 14:00 UTC = 22:00 AWST. After a stall: delete the named trial dir, rerun batch.sh.

## Test 1 batch results (ran 2026-11-17 14:00-18:22 UTC = 22:00-02:22 AWST; scored 2026-11-18 13:40 AWST)

24 of 24 trials valid (no API errors, no stall, no 12+ not-attempted). Scored with test1/score.mjs.

**Confirmatory: C1 NOT SHOWN.** cm - full = -13.0 points, bootstrap 95% [-36.5, +1.6], 8 paired seeds;
paired t [-39.2, +13.1]. Per seed: s1 +8.3, s2 -4.2, s3 -20.8, s4 0, s5 -4.2, s6 0, s7 -87.5, s8 +4.2.

| Arm | Acted-on | Rate (Wilson 95%) |
|:--|--:|:--|
| cm | 159/192 | 82.8% (76.8-87.5) |
| compact | 187/192 | 97.4% (94.0-98.9) |
| full | 184/192 | 95.8% (92.0-97.9) |

Predictions: P1 yes (full 95.8%), P2 no, P3 no (compact was 1.6 above full), P4 no (cm 14.6 below
compact), P5 no (cm lowest type in-flight, 14/24), P6 yes (cm written 94.3%), P7 yes (22 misses written
but not acted on), P8 yes (7 of 8; s8 cleared twice). Leaks (3+ of 24 below full): ruling, do-not,
reversed, open-question, in-flight, path, number. Note 7 of the audit did not apply: the arms separated.

### Why (exploratory, read from the transcripts)

1. **One seed carries most of the gap, and its cause is a product fault.** s7's third handover was
   written as a narrow handover for the reading task: "Decided, not yet applied: None", "Decisions
   already made" held only the commit-message rules, and a line said the standing rules were listed
   there when they were not. The 24 facts then reached the final session only through cornerman's
   appended rulings log, which (a) left entries out to stay short ("5 older or plainer entries left
   out"; "23 calls a minute" does not appear anywhere in the final session), (b) frames entries as
   "may be requests already done", (c) keeps superseded rulings (MIT, 2 spaces, single quotes)
   unmarked next to their corrections. cm s7 missed 21 of 24.
2. **Same pattern in the second-worst seed.** Keyword scan of the restated sections (outside the
   rulings log) per handover: s7 went 11/11, 11/11, then 0/11; s3 went 5/11 then 0/11 (s3 -20.8).
   The other six chains kept their restated rules to the last handover. By the last handover the
   rulings log was trimmed in all 8 chains. So when the writer restates the rules, cm is close to
   full; when it does not, the safety net does not hold.
3. **Without s7 (exploratory, not a replacement for the frozen test):** cm - full -2.4, bootstrap
   [-9.5, +3.0], t [-11.0, +6.2]; cm 92.9%, full 95.2%, compact 97.0%.
4. **In-flight is the weakest type outside s7 too** (7 of cm's 10 in-flight misses are in other seeds,
   several "no files changed"). s6's handover turned "step 5 is the only part left" into "wait for
   the go-ahead": the handover attaching its own condition to a user ruling (lead (a) from round 4).
   Read more transcripts before calling it confirmed.
5. **Lead (b) confirmed:** cm reversed facts with the superseded wording still in a handover, 24/24.
6. **compact did not lose anything** at this context size (97.4%, 1.6 above full). Test 1 does not
   show cornerman beating compact on carry-forward; that question belongs to Test 2 (cost, quality).

### Fix candidates for cornerman (not built)

- Never trim the rulings log silently; when it must shrink, drop requests already done, never rules.
- Mark a superseded ruling as replaced (or drop it) when a later ruling contradicts it.
- Frame the log as "standing rules unless replaced", not "may be requests already done".
- Writer check at save time: if the previous handover restated N standing rules and this one restates
  far fewer, carry the missing ones forward (as "Carried forward" already does for open items).

Release 0.7.4 stays on hold: these faults are in the code it would ship.

## Floor arm results (exploratory; ran 2026-11-18 05:36-07:07 UTC = 13:36-15:07 AWST)

Plain `/clear` after work turns 3, 6, 9, no cornerman, seeds 1-8. 8 of 8 valid: clears at [3, 6, 9] in
every trial, memoryFiles [] everywhere, no driver errors, 1-2 not-attempted per trial (the rest are real
attempts scored "violated"). Scored with test1/floor-score.mjs; full output in
test1/results/floor-2026-11-18.md. floor-score.mjs has no validity checks, so the frozen score.mjs
rules were applied by hand in the proof-read (below): all 8 pass.

| Arm | Acted-on | Rate (Wilson 95%) |
|:--|--:|:--|
| floor | 11/192 | 5.7% (3.2-10.0) |
| cm | 159/192 | 82.8% (76.8-87.5) |
| full | 184/192 | 95.8% (92.0-97.9) |

**Retention (cm - floor) / (full - floor) = 85.5% pooled, paired seed bootstrap 95% [59.6, 101.8]**
(B = 10,000, 8 seeds). Per seed: s1 110, s2 96, s3 74, s4 100, s5 96, s6 100, s7 0, s8 105. One seed
sets the width: without s7 (exploratory only) 97.4. Per type: ruling 83.3, decision 108.3, do-not 87.5,
reversed 87.5, open-question 95.0, in-flight 66.7, path 83.3, number 83.3.

Floor predictions: pooled <= 40% (75%) YES; pooled >= 10% (80%) NO (5.7%); lowest types number and
open-question (60%) NO on the strict reading (seven types tie at 0/24; both named types are in the tie,
so the floor cannot rank them).

What it means:

1. **C1 is not "low sensitivity".** The floor is far below 60%. The seven non-decision types score
   0/168 at the floor, so those 21 probes per trial pass only when the fact was carried.
2. **All 11 floor passes are decision facts, and every decision probe at the floor went the agent's
   default way:** JSON lines (A0, A4: 5 of 5 pass; CSV variants A1, A3: 0 of 3), ISO (B1: 4 of 4; epoch
   B0: 0 of 4), lower case (C1: 2 of 2; upper C0: 0 of 6). Only B ISO and C lower case were listed as
   leans before the batch; **decision-A JSON lines is a third lean, not flagged until now** (5 of the
   11 passes). The 11 with-default decision probes cannot tell carry from habit. The 13 against-default
   ones can: floor 0/13, cm 13/13, full 12/13.
3. Decision retention above 100% is one probe: cm 24/24, full 23/24 (full missed decision-A3 in s8),
   over a denominator the floor shrinks to 12. Noise, not a cm gain.
4. **The margin now has a scale.** Full minus floor is 90 points; cm's 13-point gap is about one
   seventh of what can be lost.
5. The confirmatory result does not change: C1 NOT SHOWN.

### Proof-read (2026-11-18 15:50 AWST, Fable 5.2)

Every count above was re-tallied from the result.json files with a separate script; all match. The
frozen validity rules (DRIVER ERROR, probe TIMEOUT, usage-limit text, API error message in a transcript,
checker-error, 24 results, memory files) pass for all 8 floor trials; each has 4 transcripts, no
compaction, the same 24 fact ids as its cm and full trial, and ran 29-30 minutes.

**In-flight "weakest type" needs a caveat: 6 of cm's 10 in-flight misses are one probe variant, and
the 4 read so far are not lost facts.** In-flight slot A, step 4 "index rebuild" (variants A2, A3,
drawn by seeds 2, 3, 4, 5, 7, 8): cm 0/6, full 4/6, compact 5/6, all "no files changed". The step-3
variants (seeds 1, 6): cm 2/2, full 2/2. Slots B and C: cm 12/16, full 15/16. Replies read in 4 of the
6 cm misses:

- s2, s8: the agent named the fact correctly ("step 4 is next, steps 2 and 3 stay") and declined to
  write the step because the repo defines no index format; it asked instead. full s3 did the same.
- s4, s5: the agent read the script (s4 said step 4 was next), then spent the turn on the handover
  skill and stopped; no clear landed during the probe (`clearedDuringProbe` false).
- s3, s7 (read 15:45 AWST): the fact was lost. Both agents treated steps 2-5 as open stubs and asked
  how to proceed, as the floor agent does. These two are real carry-forward misses, in the two seeds
  whose last handover dropped the standing rules.
- s4, s5 traced (15:45 AWST): the context crossed 70k on the first tool call of the probe turn, the
  nudge ("finish the current step ... then write a handover ... end your turn") fired, and the agent
  saved and ended with "Run /clear" after only reading the script. The relay had used its 3 clears, so
  nothing cleared and the task stayed undone. Contrast s8: a nudge during the reversed-B0 probe with
  one clear left; the relay cleared, carried on, and the probe scored obeyed.

So the 6 step-4 misses split 2 lost (s3, s7), 2 knew it and asked for a missing spec (s2, s8), 2 turn
taken by the nudge with the relay budget spent (s4, s5). The step-4 variant is under-specified (full
misses it 2 of 6); fix the probe in Test 1b, not before the seeds 1-8 rerun (it would break pairing).
Lead (a) from round 4 (handover adds its own condition) is not what these replies show.

**Fix candidate 5 (new, scope settled 2026-11-18 15:45 AWST): the nudge must not drop the user's
task when the relay cannot carry on by itself.** With the clear budget spent, "save and end your turn"
turns a task the user just gave into "run /clear". Options for the fix session: when no clear is left,
tell the agent to finish the user's request first and save after; or do not nudge mid-turn at all in
that state. The fix PR carries five fixes.

### Goal restated and release gate (Macdara, 2026-11-18 16:03 AWST)

"My overarching goal is to produce no reduction in quality while also saving tokens by clearing before
context gets in the way of claude. This research is designed to both discover improvements and
demonstrate those goals as achieved." **0.7.4 waits for stage B** (fresh seeds 9-16, all arms, with
Test 1b), not stage A.

### Token use in the Test 1 trials (exploratory, 2026-11-18; same 32 trials, equal work in every arm)

Summed from the `usage` field of every API call in each trial's transcripts (deduplicated by message
id), median of 8 seeds. Cost is in input-token equivalents with assumed weights (cache write 1.25,
cache read 0.1, output 5); trials ran on the subscription, so this is a relative measure only.

| Arm | Input processed | Output | Cost | Cost vs full (per-seed range) | Peak context | Acted on |
|:--|--:|--:|--:|:--|--:|--:|
| full | 27.8M | 61k | 3.36M | 100% | 277k | 95.8% |
| compact | 10.3M | 50k | 1.64M | 49% (43-52) | 106k | 97.4% |
| cm | 11.3M | 60k | 1.80M | 53% (42-58) | 110k | 82.8% |
| floor | 8.2M | 49k | 1.37M | 41% (37-44) | 106k | 5.7% |

What it means for the goal: clearing does save about half the tokens against full context on this
task, and the floor shows the saving that is left to win is small (41% against cm's 53%). **The arm to
beat is compact, not full:** on this task compact costs slightly less than cm and lost nothing.
cornerman meets the goal only when it matches compact on quality at equal or lower cost, or wins where
compaction does lose something. Test 1 does not contain such a case (context peaked at 277k and
compact kept 97.4%); finding one is Test 2's calibration job.

**Decided (Macdara card 2026-11-18, about 15:10 AWST; release gate superseded above):** build all 4 fix candidates in one cornerman PR, then
rerun the cm arm on seeds 1-8 and compare with the batch's full and floor arms. 0.7.4 stays held until
that rerun shows the gap closed. Test 1b design comes after.

### Why compact lost nothing (checked 2026-11-18 16:10 AWST)

The `/compact` summary has a fixed section 6, "All user messages", that quotes every user message
word for word and is carried from one summary to the next. Checked in seeds 1, 3 and 7: all three
summaries of each trial quote 24 of 24 planted facts (8-word run of the plant text), in 11k-15k
characters. Every Test 1 fact is a short standalone user message, so the test plants facts in the one
place compaction copies verbatim. Test 1 therefore says nothing about what compaction loses; it only
shows that cornerman's rulings log (same idea, but trimmed and framed as "may be requests already
done") is less faithful than compact's section 6.

What section 6 cannot carry, and Test 1b / Test 2 should plant: a decision that lives in an assistant
message (the user's "yes, do that" is quoted, the option it refers to is not), a fact found in a tool
result or a file, work state in flight, the agent's own reasoning for a choice, and sessions with far
more user messages than the roughly 40 here (the list has to be cut at some point; where is not
measured). Compaction here was also typed by hand at about 100k tokens of filterable reading, not
forced at the limit mid-task.

### Stress test with a hybrid arm (design drafted 2026-11-18 16:45 AWST)

Macdara asked (16:33 AWST) whether to build a test that stresses every edge case and optimise against
it, or pivot to building on compact. Answer: one test decides both. Draft in STRESS-TEST-DESIGN.md:
ten plant classes hostile to compaction, to the handover, or to full context; five arms (full, native
compact, hybrid, cm, floor); a development set and a held-out set; a decision rule for keep, pivot or
thin layer. It is stage B. Spike result: the CLI (2.1.316) has PreCompact (stdout becomes compact
instructions), PostCompact (receives the summary) and a native early auto-compact window
(`--autocompact`, 100k minimum), so the hybrid is buildable from hooks and "compact earlier" needs no
plugin. Read from the binary's strings, not yet run in the rig.

## Rig spike of the compaction hooks (2026-11-18 21:15 AWST)

Run in one container: all five capabilities in STRESS-TEST-DESIGN.md hold at CLI 2.1.316. A 100k
auto-compact window fired at 68,315 tokens, in the middle of a turn. Detail in STRESS-TEST-DESIGN.md,
"Spike result". This replaces "not yet run in the rig" above.

## Stage A results: cm rerun on seeds 1-8 after the five fixes (ran 2026-11-18 21:20-22:55 AWST)

Predictions were committed before the run (`test1/PREDICTIONS-STAGE-A.md`, commit 85b1313). cornerman
at 474f66b (main after PR #217). 8 of 8 trials valid. Scorer output:
`test1/results/stage-a-2026-11-18.md`. Full, compact and floor are the Test 1 trials from 17 and 18
November, so every comparison below is across days.

**This is a regression check on the seeds the fixes were diagnosed from. It passes. It does not show
the carry-forward claim; stage B does that.**

| | s1 | s2 | s3 | s4 | s5 | s6 | s7 | s8 | pooled |
|:--|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| cm, Test 1 (107ff1f) | 24 | 22 | 17 | 23 | 23 | 24 | 3 | 23 | 159/192 (82.8%) |
| cm, stage A (474f66b) | 24 | 22 | 23 | 24 | 24 | 24 | 22 | 22 | 185/192 (96.4%) |
| full, Test 1 | 22 | 23 | 22 | 23 | 24 | 24 | 24 | 22 | 184/192 (95.8%) |

- cm - full: +0.5 points, paired seed bootstrap 95% [-3.1, +3.6]. Exploratory: tuned seeds.
- cm - compact: -1.0 [-4.2, +2.1]. compact was 187/192.
- Cost: cm median 1.80M input-equivalents per trial, 53% of full, the same as Test 1. compact 49%.
- By type, of 24: in-flight 18 (was 14), open-question 23 (was 19), every other type 24.

The 7 misses, each read in the transcript:

- 5 are in-flight probes scored not-attempted (s2, s7, s8 migrate step 4; s7, s8 archive). In all five
  the agent named the right next step, found that the repo does not specify it, and asked. That is the
  probe fault recorded in the proof-read, now seen on the archive probe too. No fact was lost.
- s2 in-flight-C0 and s3 open-question-A4 are violated in the cm, compact and full arms alike on the
  same seeds, so they are not carry losses.

So no stage A miss traces to a fact lost across a clear. On these seeds the remaining gap is the rig.

### Predictions (10 of 12 came true)

| # | Prediction | Result |
|:--|:--|:--|
| A1 | pass rule holds | YES |
| A2 | cm pooled 173 or more | YES, 185 |
| A3 | seed 7 at 20 or more | YES, 22 |
| A4 | seed 3 at 20 or more | YES, 23 |
| A5 | no seed below 18 | YES, lowest 22 |
| A6 | step-4 probe 2 or more of 6 | YES, 3 of 6 (s3, s4, s5) |
| A7 | seeds 2 and 8 miss step 4 by asking | YES |
| A8 | no probe turn ends with a handover and a /clear ask, task undone | NO, by the wording: see fault 7 |
| A9 | no superseded ruling unmarked in the final session context | NO: 5 of 24, see fault 8 |
| A10 | cm - full lower bound above -10 | YES, -3.1 |
| A11 | 3 clears in at least 7 of 8 | YES, 8 of 8 |
| A12 | cm cost at most 60% of full | YES, 53% |

### Three faults stage A found (none fixed yet)

**Fault 6: the CLI cuts the session-start context to a 2KB preview when it is over about 10KB.**
`test1/stage-a-context-cut.mjs`. cornerman adds the handover and the rulings log as one hook output.
Above roughly 10KB, Claude Code saves it to a file and shows the model the first 2KB with the path
("Output too large"). The first 2KB is the goal and next action. The standing rules and the rulings
log sit at the end, so they are the part that is cut.

| | loads cut, of 24 | agent opened the full copy |
|:--|--:|--:|
| Test 1 cm | 21 | 19 of 21 |
| Stage A cm | 23 | 20 of 23 |

- In Test 1 the two loads that were cut and not opened are seed 7, sessions 3 and 4. That is the seed
  that scored 3 of 24. Seed 7 lost its rules at least partly because the agent never saw them, which
  the proof-read did not find (it blamed the log trim alone).
- In stage A three loads were not opened (s2, s5, s7, each session 3). All three recovered, because
  the final session opened its copy and fixes 1 and 4 had kept the rules in it.
- So carry-forward still depends on the agent choosing to open a file. Stage A passed with that
  dependency in place. The five fixes made the content right; they did not make it arrive.
- Candidate fix: keep the hook output under the cap, with the rules and rulings first; or split it
  over several outputs, each under the cap. Needs a test at the real cap, which is not yet measured
  exactly (9.9k characters arrived whole, 9.8KB was cut: bytes and characters differ).

**Fault 7: the turn-end nudge still asks for a /clear the relay cannot run.** Fix 5 covers the mid-turn
ask only. In every stage A trial the final session crossed 70k once more, at a turn end; the agent
saved a fourth handover and wrote "type /clear". The relay had no clear left, so nothing cleared and
the session ran on to 94k-104k. No task was dropped by it (in s7 the agent had already stopped to ask
its question), so it costs a turn and a handover, not a fact. A8 failed on its wording because of it.

**Fault 8: fix 2 marks a replaced ruling for some correction wordings only.** `test1/stage-a-stale.mjs`
plus reading the lines. The log marks "Use 2 spaces" as "(replaced by a later one)" when the correction
is "Actually make that 3 spaces", and marks every quotes and licence reversal. It leaves the old
indent rule unmarked in 5 of 8 trials (s1, s2, s3, s4, s5), where the correction is worded another way.
All 24 reversed facts were still acted on correctly, because the handover body states the current rule.

### Corrections to earlier text

- PREDICTIONS-STAGE-A.md says the rig files are the frozen ones, unchanged. `driver.mjs` differs from
  its frozen hash by the floor-arm commit de5cb68 (a floor branch only; the cm path is the same). The
  other frozen files match once line endings are normalised, which is how the hashes were taken.
- STRESS-TEST-DESIGN.md class F named "cm fault 5 (nudge takes the turn)". Add faults 6 to 8 to what
  the development set must exercise; fault 6 applies to the hybrid arm too, since it adds context on
  SessionStart in the same way.
