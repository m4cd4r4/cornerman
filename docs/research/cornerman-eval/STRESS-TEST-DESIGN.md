# Stress test design (Test 1b / stage B): draft 2026-11-18, design only, no trial spend

Status: DRAFT. Nothing here is frozen. Items marked **to confirm** need Macdara's ruling before the
predictions file is written.

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

Read from the strings of the installed CLI (2.1.316, the version the rig runs). **Not yet run in the
rig**: step 0 of the build confirms each line in a container.

| Capability | Evidence | Use |
|:--|:--|:--|
| `PreCompact` hook, matcher manual or auto | "Exit code 0 - stdout appended as custom compact instructions. Exit code 2 - block compaction" | cornerman adds its own instructions to every compaction, typed or automatic |
| `PostCompact` hook | "Input to command is JSON with compaction details and the summary" | cornerman reads the summary, checks it against the rulings log, saves it as a file |
| `SessionStart` with matcher `compact` | cornerman's hooks.json already matches `startup\|clear\|compact` | cornerman adds the rulings log and carried-forward items after the compaction |
| Early auto-compact is a native setting | `--autocompact <auto\|tokens>` (100k to 1M), `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, a settings key | the free competitor: anyone can compact early without a plugin. Floor of 100k |
| The relay can type `/compact` | it types `/clear` today; the rig driver already types `/compact` | compaction at a threshold below 100k, or between turns only |

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

**To confirm:** compact arm = native auto window (proposed, it is what a user would really get) or
`/compact` typed between turns as in Test 1 (cleaner pairing, nobody does it).

The hybrid is a thin prototype (hooks only, no new UI). If it wins, it is built properly afterwards.

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
- Density per trial: **to confirm**, proposed 3 facts per class in A-H (24), plus one volume trial
  design (I) and one interference chain (J) per seed.

## Development set and held-out set

Optimising against a test we wrote will pass that test whether or not the product is better. So:

- **Development set:** seeds 101-108. Run as often as needed, read every transcript, change cornerman
  and the hybrid freely.
- **Held-out set:** seeds 201-216, with different wordings, values and files for every class, authored
  and hashed before the first development run and not run until the candidates are frozen.
- The held-out set is run once. If a candidate fails and is changed, a new held-out set is authored;
  the old one becomes development data.
- **To confirm:** 16 held-out seeds per arm (80 trials, about 14 hours at 3 in parallel). Test 1's
  interval at n = 8 was 38 points wide because of one seed.

## Decision rule (to be frozen in a PREDICTIONS file before the held-out run)

Primary measure: pooled acted-on over classes B-I on the held-out set, paired seed bootstrap, 95%.
Cost: input-token equivalents per trial from `test1/tokens.mjs`.

| Outcome on the held-out set | Decision |
|:--|:--|
| cm - compact lower bound above -5 points, and cm cost at most 110% of compact | keep the handover as the in-session engine |
| hybrid - cm lower bound above 0, or cm fails the row above while hybrid - compact lower bound is above -5 | pivot the in-session engine to the hybrid |
| hybrid - compact upper bound below +5 (the plugin adds nothing measurable to compaction) | in-session cornerman becomes a thin layer (settings and PreCompact instructions); the product leads with cross-session handovers |
| winner - full lower bound above -5 points | the "no reduction in quality" claim is shown for these classes, with the cost saving and the floor next to it |

**To confirm:** the 5-point margin (Test 1 used 10; the floor showed 90 points of range, so 5 is about
one eighteenth of what can be lost).

Class J is reported separately: it tests whether full context drops, which is Test 2's premise.

## Not in this test

- Cross-session carry (new session, other worktree, next day). Compaction cannot do it, so there is no
  comparison to run; it gets its own small check against the floor.
- Haiku and Opus, and the headless path. Sonnet, interactive, as in Test 1.
- Quality of the work itself (Test 2). This test measures what is carried, and class J only opens the
  question of whether long context hurts.

## Build order

0. Rig spike: confirm the five capabilities above in a container, at 2.1.316.
1. Hybrid prototype (hooks only).
2. Plant classes, probes and checkers; floor run of every variant; fresh fairness review by a separate
   reviewer.
3. Author and hash the held-out set.
4. Development runs and fixes, until the per-class results stop moving.
5. Freeze candidates and PREDICTIONS; one held-out run; score; decide.

Depends on: the five-fix PR (Vikunja #4114) and its stage A regression rerun.
