# Stress test design (Test 1b / stage B): draft 2026-11-18, design only, no trial spend

Status: DRAFT. Nothing here is frozen. Margin, held-out n and the threshold range were ruled on 2026-11-18 16:50 AWST; density per trial is
still **to confirm**.

## What it decides

Goal (Macdara, 2026-11-18): no reduction in quality while saving tokens by clearing before context
gets in the way. Test 1 could not test that against the real competitor: every fact was a standalone
user message, which `/compact` copies word for word (PROJECT-PLAN.md, "Why compact lost nothing").

This test answers three questions, in this order:

1. Where do a compaction summary and a cornerman handover each lose things?
2. Is the best in-session engine the handover (cm), native compaction, or a hybrid of the two?
3. Does the winner hold quality against full context, and at what token cost?

It is also stage B of the release gate: 0.7.4 waits for the held-out run of this test.

## Spike: what a plugin can do around compaction

Read from the strings of the installed CLI (2.1.316, the version the rig runs), then **confirmed in
the rig on 2026-11-18 21:15 AWST** (one container, Sonnet, no cornerman, three logging hooks;
`rig/spike/spike-compact.mjs`, result in `rig/spike/result/`). Every line below held. See "Spike
result" under the table for what the run added.

| Capability | Evidence | Use |
|:--|:--|:--|
| `PreCompact` hook, matcher manual or auto | "Exit code 0 - stdout appended as custom compact instructions. Exit code 2 - block compaction" | cornerman adds its own instructions to every compaction, typed or automatic |
| `PostCompact` hook | "Input to command is JSON with compaction details and the summary" | cornerman reads the summary, checks it against the rulings log, saves it as a file |
| `SessionStart` with matcher `compact` | cornerman's hooks.json already matches `startup\|clear\|compact` | cornerman adds the rulings log and carried-forward items after the compaction |
| Early auto-compact is a native setting | `--autocompact <auto\|tokens>` (100k to 1M), `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, a settings key | the free competitor: anyone can compact early without a plugin. Floor of 100k |
| The relay can type `/compact` | it types `/clear` today; the rig driver already types `/compact` | compaction at a threshold below 100k, or between turns only |

### Spike result (one run, n = 1 per check)

| Check | Result |
|:--|:--|
| PreCompact exit 2 on a typed `/compact` | Blocked. No compaction; the screen shows "Compaction blocked by PreCompact hook" |
| PreCompact stdout | Reached the summariser on manual and auto: the marker line it asked for is in both summaries |
| PreCompact input | `trigger` (manual or auto), `custom_instructions`, `transcript_path`, `session_id`, `cwd` |
| PostCompact input | `trigger` and `compact_summary` (the whole summary, 4,849 and 6,662 characters) |
| SessionStart after compaction | Fired with `source: compact` both times. The model then answered with a fact that only the hook supplied |
| `--autocompact 100000` | Accepted. Compaction fired by itself, mid-turn, with trigger auto |

Four things the run showed that the binary text did not:

1. **A 100k window compacts at about 68k.** The auto compaction fired at 68,315 tokens before and left
   8,761 after. One data point: whether the gap is a fixed reserve (about 32k) or a share of the window
   (about 68%) is unknown until a 250k run. Test 1's cm nudge was 70k, so the Test 1 cm arm already
   cleared at about the point where native compaction at the minimum window fires.
2. **Auto compaction fires in the middle of a turn** (here after the reads of a work turn, before the
   turn ended), and the agent carried on and finished the turn. cornerman's mid-turn nudge is the
   path that dropped the task in Test 1 seeds 4 and 5 (fault 5).
3. **The user-message list is not always word for word.** After four near-identical task messages the
   second summary wrote "The same request for <files>" for the later ones. The first message, with the
   codeword, was still quoted in full. This is the cut class I (volume) is meant to find.
4. **A fact added by the SessionStart hook was written into the next summary** as a standing note. So
   context a plugin adds after one compaction can ride through later ones without being added again.
   It can also be reworded or dropped there; the hybrid should add it every time and not rely on this.

Consequence for the product: "compact earlier" needs no plugin. In-session, cornerman has to add
something that native early compaction lacks, or step aside there and keep what compaction cannot do
at all (a handover into a new session, another worktree, the next day).

## Arms (same seeds, same facts, same W work turns in every arm)

| Arm | What runs | Role |
|:--|:--|:--|
| full | no clear, no compaction | ceiling |
| compact | native auto-compact, window 100k, no plugin | the free competitor |
| hybrid | native auto-compact, window 100k, plus cornerman: PreCompact instructions, rulings log and carried items added on SessionStart `compact` | the pivot candidate |
| cm | cornerman with the five fixes, nudge set so it clears at about the same context as the others compact | the current engine |
| floor | plain `/clear` at the same points, no plugin | scale |

The hybrid is a thin prototype (hooks only, no new UI). If it wins, it is built properly afterwards.
Compaction in the compact and hybrid arms is the native auto window, which is what a user really gets.

### Hybrid prototype as built (step 1, 2026-11-19; `rig/hybrid/`)

Five hooks, no model call in any of them. cornerman is cloned for its lib only (rulings log and
"mentioned" test imported from fea0cee, so the hybrid and cm log and bound the user's words with the
same code); the plugin is not installed and none of its own hooks run.

| Hook | File | What it does |
|:--|:--|:--|
| UserPromptSubmit | `prompt.mjs` | Logs the user's words; keeps an uncut copy |
| PreCompact | `pre.mjs` | Asks the summariser to end with a "Carried forward" list, tagged rule, choice, fact, decision, in flight, ask first |
| SessionStart, source compact | `start.mjs` | Adds the rulings log (replaced ones marked), and durable items already missing from the summary before this one. At most 9,000 characters |
| PostCompact | `post.mjs` | Saves the summary, files its tagged items, records which standing rules the summary lost (the arm's "carried" score), finds what this summary dropped |
| PostToolUse | `deliver.mjs` | Hands the model what the latest summary dropped, once, at the next tool call |

Measured in four smoke runs (Sonnet, 100k window, one typed and one auto compaction each, n = 1 per
check; `rig/hybrid/result/`). Selftest: `node rig/hybrid/selftest.mjs <cornerman lib>`, 31 checks.

1. **Order at a compaction: PreCompact, summary, SessionStart to its end, PostCompact, and only then
   is the summary written to the transcript.** So a SessionStart hook can never see the summary just
   made. What that summary dropped is known to PostCompact alone, which is why a fifth hook
   (PostToolUse) delivers it. It arrived 2 to 5 seconds after the compaction, in the middle of the turn.
2. **A note delivered on PostToolUse is not trusted unless announced.** In smoke 3 the model took it
   for text appended to the file it had just read and answered "I'm not treating it as known". With
   one sentence in the SessionStart context saying such a note may follow and comes from the same
   hook (smoke 4), it used the fact. One run each way.
3. The instructions worked in 8 of 8 summaries: the section was there with 14 to 23 tagged items, and
   no standing rule in the log was missing from any summary. These smokes plant 3 rules, 1 choice and
   1 tool-result fact, all recent, so this says the plumbing works and nothing about loss.
4. Cost of the instructions: the summary grew from 6,662 characters (spike, auto, no hooks) to 10,551
   to 13,018, and the context after an auto compaction from 8,761 tokens to 10,991 to 14,427. Not like
   for like (the spike conversation had fewer planted messages). Measure in the development set.
5. Auto compaction fired at 66,250 to 67,406 tokens in four runs, against 68,315 in the spike.
6. Each summary rewords the items it copies, so the item file grows (18 then 23 items gave 31 lines in
   smoke 3). It does not change what is delivered: an item counts as dropped only when the whole
   summary no longer holds it, and a digit-bearing word of the item must be present.

Not built, for the development runs to decide: `[rule]` and `[in flight]` items are never re-added
(the log covers rules word for word; an old in-flight state would be wrong), and the delivery note has
no user-visible line.

## Threshold is a factor, not a constant (Macdara, 2026-11-18 16:50 AWST: "Is 100k a bit low? Should we have a range of tests?")

Yes to both. 100k is the lowest window the CLI accepts and the most aggressive setting; Test 1's 70k
nudge was sized to the rig's small reading set, not to real use. cornerman ships with 250k. The
threshold is the dial the goal turns on: lower saves more tokens and crosses more clears, higher
crosses fewer clears and lets more context build up between them. So the test varies it.

| Threshold | Why | Events in one trial (fixed work, full arm ends near 800k) |
|:--|:--|:--|
| 100k | native minimum, largest saving, most clears | about 8 |
| 250k | cornerman's shipped default | about 3 |
| 500k | late clear: little saving, one large summary | 1 |

- **The event counts above are low for 100k (spike, 2026-11-18).** They assumed compaction at the
  window size. Measured: a 100k window compacts near 68k and restarts near 9k, so each cycle takes
  about 60k of new context and 800k of work gives about 13 compactions, not 8. The 250k and 500k rows
  need the same measurement in the first development trial before the table is trusted.
- The cm arm's nudge is set to the measured compaction point of the window it is compared with (68k
  for the 100k window), not to the window size.
- Work per trial is fixed and the same in every arm; the threshold alone sets how many clears or
  compactions happen. One full arm and one floor arm serve all thresholds.
- The full arm must fit in the 1M window without compacting itself, which caps total work near 800k
  tokens. The rig needs about five times its present reading material.
- Staging keeps the cost bounded. Development set: all three thresholds, 4 seeds each, to see the shape.
  Held-out set: the two thresholds that the development runs show matter (expected 100k and 250k).
- Reported per threshold: acted-on, cost, and class J (interference). The three together give quality
  and cost against context size, which is the evidence for where the default threshold should sit:
  the lowest threshold with no quality loss.
- Cost warning: a trial that reaches 800k is several times longer than Test 1's 30 minutes, and the
  full arm's token use grows roughly with the square of its context. The held-out run becomes several
  off-hours sessions inside the usage windows; estimate it from the first development trial before
  scheduling.

## Plant classes

Each class says which engine it is expected to hurt. A class that hurts neither is a control.

| # | Class | Example | Expected to hurt |
|:--|:--|:--|:--|
| A | Standalone user rule (Test 1 type) | "New code: 3 spaces per indent." | neither (control) |
| B | Rule inside a long task message | a 15-line task with one standing rule in the middle | cm (writer must lift it out); compact if long messages are shortened |
| C | "Yes, do that" to an option the agent described | agent offers 3 options, user replies "the second one" | compact (the option is in an assistant message); cm (writer must record the resolved choice) |
| D | Fact from a tool result that later disappears | a one-off script prints the staging port; the script is then deleted | both (never a user message) |
| E | Agent's own decision and its reason | approach Y was tried and failed, X chosen; the probe tempts Y again | both |
| F | Work in flight | steps 1-3 of 5 done, uncommitted; step 4 fully specified in the repo this time | both; cm fault 5 (nudge takes the turn) |
| G | Fact given late or mid-turn | a rule given between the second and third clear; a correction typed while the agent is working | cm (log timing); compact (recency helps it) |
| H | Rule reversed late | "2 spaces" becomes "tabs" after the second clear | cm (superseded ruling unmarked) |
| I | Volume | 24 rules scattered through 150+ user messages | compact (the user-message list must be cut somewhere); cm (log size bound) |
| J | Interference | one value changed four times in near-identical wording, 200k tokens apart | full context (the arm that keeps all four); bridge to Test 2 |

Rules for every plant, carried over from Test 1 and the proof-read:

- The probe is a task, never a quiz, and is fully specified without the fact's source (the Test 1
  step-4 probe failed this).
- A probe must not be answerable by re-reading the repo: the source of D and E facts is gone by probe
  time.
- No variant may match the agent's default. Every variant is run once in the floor arm before the
  design is frozen; a variant the floor passes is dropped (Test 1 had three such decision leans).
- Two scores per fact: carried (present in the handover, or in the summary read from PostCompact) and
  acted on (hidden checker). Reported per class, never pooled alone.
- Density per trial: 3 facts per class in A-H (24), plus one volume trial design (I) and one
  interference chain (J) per seed. Adopted 2026-11-19 as the working value for the development set
  (the proposal stood unanswered; development runs can change it, the held-out freeze fixes it).
- From stage A2 (2026-11-19): an ask is judged from what the agent did and said, never from a question
  mark in the text. Test 1's open-question checker scored a clear "I need your OK" as not attempted.
- From stage A2: class I must reach the point where cornerman's rules part is over its
  9,000-character budget and drops a standing rule, naming it. Test 1 filled the budget by the third
  load with 24 facts and only ever dropped task requests. The probe for the dropped rule is the case
  to measure: does the agent open the full copy and obey it.

### Step 2 design: how each class is delivered (2026-11-19, settled, not yet built)

A class is the way a fact arrives. Its content is one of Test 1's 24 probe targets (8 types, slots
A-C in `test1/facts.mjs`), so the checkers already proven by `test1/selftest.mjs` are reused. New
code goes in `stress/`; nothing under `test1/` is edited.

| Class | Targets | Delivery |
|:--|:--|:--|
| A | ruling-C, do-not-C, path-A | Standalone note at the start (control) |
| B | ruling-B, do-not-B, number-B | The rule sits in the middle of a 15-line work task message |
| C | number-A, number-C, decision-C | The agent writes numbered options (three candidate values, not round numbers; or both camps); the user picks by position ("Go with the second"). The driver parses the reply and sets the expected value at run time. Parse fails: plant invalid, fact excluded and reported |
| D | path-B, path-C, ruling-A | The value is printed by a tool, `ledger-ops <topic>`, kept outside /work so git history cannot hold it; the driver removes the topic after use |
| E | decision-A, decision-B, do-not-A | `ledger-ops <survey>` prints evidence, the user asks for a verdict and no build, the driver checks the reply names the expected option, the user answers "OK, go with your call." |
| F | in-flight A, B, C | One task: "step 2 I did by hand, leave its stub; do step 3 now, no commit, stop". Probe "Carry on with ..." expects the next step with earlier stubs untouched. Overlay copies of the three scripts specify every step in a comment |
| G | open-question A, B, C | A and B as notes at about 70% and 80% of the work turns; C typed 8 seconds into a running work turn at about 75%. New checker: an ask is judged from what the agent did and said |
| H | reversed A, B, C | Early plant at the start, correction at about 85-91% |
| I | 3 new numeric rules on new stub files | Given first (oldest, so cornerman's bound drops them first), then about 48 filler standing rules, one after each work turn, none of which may affect a checker. New numeric checker |
| J | 1 new numeric value | Changed four times in near-identical wording at about 5%, 30%, 55%, 80%; the probe uses the last. Reported separately |

- 28 probes after all work turns, in a fixed order. (Changed 2026-11-19: shuffled per seed, see "Step 2 as built".)
- Floor variant check is short: plants, one `/clear`, probes, with a forced variant index (k mod pool
  size), so 6 runs cover every variant. A variant the floor passes is dropped.
- Arms in the driver: full (confirm in the first trial that the container's Sonnet has a 1M window);
  compact (`claude --autocompact <window>`); hybrid (the same plus the `rig/hybrid` hooks, cornerman
  cloned for its lib only); cm (`CORNERMAN_NUDGE_AT` at the measured compaction point; the relay's
  default budget is 3 clears and about 13 are needed, see `budget()` and the `relay` option in
  cornerman `plugin/hooks/relay.ts`); floor (`/clear` at the same context size).
- Reading material in the image: npm docs, 83 files, 486 KB; 18 READMEs over 3 KB under
  npm/node_modules, 187 KB. Too little for 800k tokens at 6 files a turn (about 15k tokens a turn in
  the smokes). Add reading, and measure in the first development trial.
- Estimate, not measured: about 2 hours per 800k trial (50 work turns, about 100 short notes, 28 probes).

### Step 2 as built (2026-11-19; `stress/`)

| File | What it is |
|:--|:--|
| `plants.mjs` | `plan(seed, set, { force })`: 28 facts, the steps the driver sends, 48 fillers, the probe order. Reads class C option lists and class E verdicts |
| `set-dev.mjs`, `set-dev-fillers.mjs` | Development wordings (seeds 101-108). The held-out set is a second file of the same shape |
| `checks/ask-first.mjs` | Class G: an ask judged from what the agent did and said |
| `checks/numeric.mjs` | Classes I and J: measures the number the code behaves as |
| `fixture-overlay/` | Four numeric stubs and the three step scripts with every step specified in a comment |
| `ops/ledger-ops.mjs` | Prints a topic kept outside /work (classes D and E); the driver deletes the topic after one use |
| `driver.mjs` | Five arms, in tmux in the container. `--short` is the floor variant check |
| `reading/build.mjs` | Reading corpus for the work turns: 313 files, 3.3 MB, hashed |
| `floor-check.sh` | Launches the short floor runs, forced variant k = 0 to 5 |
| `selftest.mjs` | Every plan, checker, overlay script and reply parser, before any trial |

A separate reviewer (Sonnet, given the code and this design, not the builder's reasoning) returned 21
findings: 1 blocker, 14 to fix, 6 minor. Applied:

- The leak scan ran before the shadow repo existed and crashed the first probe (the blocker).
- Class E: the verdict is read from the agent's last text block. A line said before the tool call made
  every such plant invalid.
- A compaction summary, a hook or command entry and the relay's reload line are not the user speaking,
  in the driver and in the ask-first checker. Replies and checkers read all transcripts joined.
- floor: `/clear` is typed only after a whole plant step, work turn or filler, so it cannot fall
  between a class C ask and its pick. A clear or compaction between the two messages of a C or E plant
  in any arm is flagged on the result row (`plantSplit`).
- `plantedAt` is set before the plant is sent; `eventsCrossed` is counted to each probe.
- `plan.json` is written when the trial ends, and the fact file is deleted after each checker run: the
  agent can read /out and /tmp. Tool calls naming /stress, /test1, /out or a checker file are listed in
  `result.json` (`offLimits`).
- ask-first: a changed file with the probe missing from the transcript is a violation. The wording
  list gained "would you like", "your input, preference, thoughts", "please advise", "could you",
  "do you prefer", "pausing here" and lost "let me know" and "not changed".
- numeric: a cut memo must be a prefix of the input (N - 1 characters plus an ellipsis passed before).
  The expiry stub states its boundary.
- The three reversed probes run first: a file an earlier probe wrote would show them the style.
- Eight fillers reworded: four pushed toward acting without asking or toward committing, four were
  one half of a contradicting pair.

Three review points went to Macdara (card, 2026-11-19 15:25 AWST), all ruled:

- **Probe order: shuffled per seed**, the same in all five arms for that seed, reversed probes still
  first. A fixed order tied each class to a position.
- **Probe phase: keep, report per probe.** compact, hybrid and cm go on compacting or clearing during
  the 28 probes, as a user would have them; full and floor do not. Each row carries `eventsCrossed` and
  `eventDuringProbe` so the analysis can split by them. Trim work turns if the first development trial
  shows the full arm passing 1M.
- **Class B lead-in softened** to "By the way, from now on:". "Separate from this job, and standing
  for all later work:" read like a label for a summariser.

Floor run 0 (forced variant 0, short, commit 00e6de6, 2026-11-19, n = 1):

- 34 minutes: plants and 4 work turns 19, the 28 probes 15. 0 invalid plants, 3 of 3 class C option
  lists read, 3 of 3 class E verdicts read, no split plant, no off-limits tool call.
- The floor passed 0 of 28: 27 violated, 1 not attempted (A-path-A, where the agent put up a question
  card, which the driver cancels). No variant 0 is dropped.
- **A work turn of 6 files adds about 40k tokens, not 15k** (with the first task wording; the
  reworded task below adds 10k to 20k): context after the four work turns was
  61k, 104k, 144k, 180k. 50 such turns would be about 2M, twice the full arm's window. 2 files a turn
  gives about 13k a turn and about 650k over 50 turns, and keeps one filler per turn. To settle in the
  first development trial (`--per-turn`).
- The leak scan flagged 14 of 28 probes, the floor failing every one of them. It matches any one line
  holding every `written` pattern, and patterns like a small number plus a common word match reading
  notes and docs by chance. As it stands the flag cannot tell a leak from noise; tighten it before the
  development runs.

Floor runs 1-5 (commit 5432bff, 2026-11-19, n = 1 each): 0 invalid plants in all five. The floor
passed 16 of 140 probes, for three different reasons:

| Cause | Probes passed | Action |
|:--|:--|:--|
| **The repo carried the fact.** The work-turn task asked what in each file "could matter for ledger and why", and the agent wrote planted rules into `docs/reading-notes.md` before the clear ("6-attempt cap on bank feed calls", "the 7-attempt rule", "the lower-case account id rule") | I-attempts in runs 1, 2 and 5; I-memo and B-number-B in run 5 | Work-turn task reworded: the notes say what each file documents, and ledger's rules never go in them. Leak scan narrowed to lines the agent added. Runs 1, 2 and 5 rerun to confirm |
| **The variant is the agent's default** | E-decision-A "jsonl" 3 of 3; E-decision-B "iso" 3 of 3; C-decision-C "lower case" in 2 runs | The two E variants are dropped (each E decision now has one variant). For C the pick is by position, so the driver now picks the position of the upper-case option at run time |
| **Passed once in three runs** | B-ruling-B variant 1 (TypeError on a fractional amount), G-open-question-C variant 0 (asked by a question card unprompted) | Both dropped by the rule, in a filtered copy of Test 1's pools in `set-dev.mjs` |

The first row is not a variant fault. It would have run in every arm for 50 work turns and let any
arm pass from the repo. It applies to the held-out set too.

Confirmation, floor runs 1, 2 and 5 again (commit b7a6c2c, 2026-11-19, n = 1 each): **the floor passed
0 of 83 probes** (79 violated, 4 not attempted behind a cancelled question card), no off-limits tool
call, and the class C pick landed on the upper-case option in both runs that read it.

- One plant was invalid: in run 5 the agent's upper-case option argued "easy to tell apart from other
  lower-case fields", so the line matched both options. The reader now looks at the start of the line.
- **With the reworded task a 6-file work turn adds about 10k to 20k tokens**, not 40k: context after the
  four work turns was 52k, 72k, 88k, 99k (run 1), 51k, 65k, 79k, 86k (run 2), 38k, 51k, 64k, 71k (run 5).
  The earlier 40k was the agent searching the repo to tie each file to ledger. 50 turns of 6 files is
  then about 500k to 1M: still to settle in the first development trial.
- The narrowed leak scan flags 5 or 6 probes a run, down from 14, all on docs the class B tasks had
  the agent write (`docs/export.md`, `docs/storage.md`, `docs/reports.md`) or on code from earlier
  probes. The floor failed every flagged probe, so none is a real leak; read the flag with the file named.

### Step 3 as built: the held-out set (2026-11-20; `stress/set-held.mjs`)

Three rulings by Macdara (card, 2026-11-20 07:55 AWST):

- **New content on the same rig.** Test 1's checkers, the fixture and the probe shapes are kept, because
  they are frozen and proven; a held-out set on new files and new checkers would put code that has
  never run into a run that happens once. Every plant wording, value, rule, function name, B task,
  survey, ops topic and filler is new. Known weakness: the fact topics overlap with the development
  set, so a candidate tuned to a topic could still pass.
- **Floor variant check, then hash.** The six short floor runs go first (floor arm only, no candidate
  can be tuned to them); a variant the floor passes is dropped; the hash is taken after that.
- **Hash first, then the first development trial.** No development trial was run or read before the
  set was written.

What is new and what is kept:

| Class | Kept from the rig | New in the held-out set |
|:--|:--|:--|
| A | checkers, look-alike config files | rules: negative amounts in brackets, or no decimals on whole amounts; `src/storage/` frozen with a sort-on-read probe; timezone probe |
| B | checkers, lead-in "By the way, from now on:" | three docs tasks (invoicing, Ledger class, legacy); rules: amounts above 100,000,000 cents or zero rejected; `src/index.js` frozen; batch sizes 36, 52, 84, 132 |
| C | option parser, range 11 to 95 | ask and pick wording; functions `canonicalAccountId`; the pick is still the upper-case option |
| D | `ledger-ops`, look-alike rate and template files | topics rates-source, mailer-check, rounding-policy; rules: round up, or nearest 10 cents; SGD and subject-line probes |
| E | verdicts csv, epoch, frozen (the only ones an untold agent does not take anyway) | evidence: backup trial, sync trial, invoice audit; probes `recordChargeback`, `auditRecord`, a comment sweep with `src/invoice.js` frozen |
| F | the three step scripts and their steps | task and probe wording |
| G | ask-first checker | gates on `record()`, entry ids, `fromV1()`, `toV1()`, `round2`, `isValidAmount` (files `src/ledger.js`, `src/legacy/compat.js`, `src/money.js`) |
| H | indentation, quotes and licence-line checkers | indents 6 and 8 spaces, licences BSD-3-Clause, MPL-2.0, 0BSD, new modules `notes.js`, `weekday.js`, `initials.js` |
| I | the three stubs | values 8, 11, 13; 37, 54, 73; 9, 12, 14; 48 new fillers |
| J | the expiry stub | chains ending 31, 24, 27; wording "a quote lapses after N days" |

- `stress/selftest-held.mjs`: 451 of 451 as authored (445 of 445 after the floor check drops). For every variant of every pool it shows one solution the
  checker calls obeyed and one it calls violated, so no held-out fact has a checker that cannot pass.
  It also checks that no message, probe, report, filler or numeric value is shared with the
  development set.
- `driver.mjs --set held` loads the held-out file; a development trial never reads it.
  `ST_SET=held floor-check.sh` runs the floor variant check into `out/stress-floor-check-held`.
Floor variant check of the held-out set (runs 0-5, floor arm only, commit e3fae04, 2026-11-20
08:11-09:20 AWST, n = 1 each, about 33 minutes a run; `out/stress-floor-check-held` on the VPS):

- 0 invalid plants, no split plant, no off-limits tool call, no memory file, no timeout in all six.
  18 of 18 class C option lists read; the pick landed on the upper-case option in 6 of 6.
- **The floor passed 3 of 168 probes** (151 violated, 14 not attempted). The 14 are the agent asking
  which file or rule applies where the fact was the answer: D-path-C 6 (a question card each time),
  D-ruling-A variant 1 "nearest 10 cents" 3, A-path-A 3, D-path-B 2.

| Passed | Run | Why | Action |
|:--|:--|:--|:--|
| D-path-B variant 2, `conf/exchange-rates.json` | 2 | The agent's default: the floor put SGD in that file in 4 of 4 runs where it edited one | Dropped (3 variants left) |
| H-reversed-A variant 2, 8 spaces then 2 | 2 | The floor indented the new module with 2 spaces | Dropped (3 variants left; none ends on 2 spaces) |
| C-decision-C, upper-case account ids | 5 | The floor wrote upper case once ("my own choice") and lower case in the other 5 runs | **Kept** (Macdara, card 2026-11-20 09:48 AWST) |

- C-decision-C is the only variant its frozen checker allows, so dropping it would leave class C with
  two facts. A lost fact there passes about 1 time in 6 in every arm alike; the held-out floor arm
  measures it. The development set carries the same choice.
- **Two of the six runs added about 40k tokens per work turn** (runs 1 and 3: 60k, 104k, 143k, 178k);
  the other four added 11k to 20k. The reworded task did not remove the large case. Settle
  `--per-turn` from the first development trial.
- The leak scan flagged 4 to 8 probes a run, on docs the class B tasks wrote and on code from earlier
  probes. The floor failed all of them except C-decision-C in run 5, flagged on `src/initials.js`
  (the probe before it asks for upper-case initials). Read the flag with the file named.
- After the two drops: selftest-held 445 of 445.

**Hash (2026-11-20 09:49 AWST, `stress/held.sha256.json`, sha256 of LF-normalised content):**

| File | sha256 |
|:--|:--|
| `stress/set-held.mjs` | `ef8cc210a72372bad122977bcffd8b2c05cfa49c3661fc066a7366b509dd06fe` |
| `stress/set-held-fillers.mjs` | `44dfdd8da5625c1c1550a63d4b2c1c801725879ca2599b2c0e48c1586fa2c31f` |

No change to either file from here. The set is run once, when the candidates are frozen.

## Development set and held-out set

Optimising against a test we wrote will pass that test whether or not the product is better. So:

- **Development set:** seeds 101-108. Run as often as needed, read every transcript, change cornerman
  and the hybrid freely.
- **Held-out set:** seeds 201-216, with different wordings, values and files for every class, authored
  and hashed before the first development run and not run until the candidates are frozen.
- The held-out set is run once. If a candidate fails and is changed, a new held-out set is authored;
  the old one becomes development data.
- **Confirmed (Macdara card 2026-11-18 16:50 AWST): 16 held-out seeds per arm.** Test 1's interval at
  n = 8 was 38 points wide because of one seed. Trial count and hours depend on the threshold staging above.

## Decision rule (to be frozen in a PREDICTIONS file before the held-out run)

Primary measure: pooled acted-on over classes B-I on the held-out set, paired seed bootstrap, 95%.
Cost: input-token equivalents per trial from `test1/tokens.mjs`.

| Outcome on the held-out set | Decision |
|:--|:--|
| cm - compact lower bound above -5 points, and cm cost at most 110% of compact | keep the handover as the in-session engine |
| hybrid - cm lower bound above 0, or cm fails the row above while hybrid - compact lower bound is above -5 | pivot the in-session engine to the hybrid |
| hybrid - compact upper bound below +5 (the plugin adds nothing measurable to compaction) | in-session cornerman becomes a thin layer (settings and PreCompact instructions); the product leads with cross-session handovers |
| winner - full lower bound above -5 points | the "no reduction in quality" claim is shown for these classes, with the cost saving and the floor next to it |

**Confirmed (same card): the margin is 5 points** (Test 1 used 10; the floor showed 90 points of range,
so 5 is about one eighteenth of what can be lost). The rule is applied per threshold.

Class J is reported separately: it tests whether full context drops, which is Test 2's premise.

## Not in this test

- Cross-session carry (new session, other worktree, next day). Compaction cannot do it, so there is no
  comparison to run; it gets its own small check against the floor.
- Haiku and Opus, and the headless path. Sonnet, interactive, as in Test 1.
- Quality of the work itself (Test 2). This test measures what is carried, and class J only opens the
  question of whether long context hurts.

## Build order

0. Rig spike: confirm the five capabilities above in a container, at 2.1.316. **Done 2026-11-18, all
   five confirmed.**
1. Hybrid prototype (hooks only). **Done 2026-11-19: `rig/hybrid/`, see "Hybrid prototype as built".**
2. Plant classes, probes and checkers; floor run of every variant; fresh fairness review by a separate
   reviewer.
3. Author and hash the held-out set.
4. Development runs and fixes, until the per-class results stop moving.
5. Freeze candidates and PREDICTIONS; one held-out run; score; decide.

Depends on: the five-fix PR (Vikunja #4114) and its stage A regression rerun. **Both done. Also done:
the faults 6-8 fix (PR #218, main fea0cee) and its rerun, stage A2, passed 2026-11-19. Step 2 is next;
the candidates start from fea0cee.**
