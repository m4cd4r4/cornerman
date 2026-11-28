# Design: show the last reply after a clear

Status: design approved 2026-11-28 (D1-D4: the recommended option each), build in progress.
Tracks Vikunja #4217. Written 2026-11-28 against main 0a08b62.

## Problem

A session often clears (by hand, or by a relay at the context threshold) before the user has read
Claude's last answer. After the clear, the load notice names `artifacts.md` and tells Claude to read
it only if asked, so the answer is gone from the screen. The user has to read every answer before
clearing, or lose it.

Goal: the first reply after a clear shows what Claude last said before it, verbatim, with its parts
labelled (answer, why, links, things to paste, questions for the user).

## What exists

- `session-end.mjs` runs `extractArtifacts` on the transcript and writes
  `~/.cornerman/artifacts/<session>/last-screen.md`: the last 2 assistant messages, redacted, cut at
  40,000 chars (#155).
- The VS Code extension lists it as "Last screen before the clear" and opens it on click
  (`extension/src/extension.ts:251`).
- `artifactsNote` in `load-context.mjs` names only `artifacts.md`, with counts. Nothing puts the
  reply in front of the user.

## Field data (handovers saved 2026-11-14 to 2026-11-28, one row per saving session)

| Measure | Result |
|---|---|
| Saving sessions | 358 (468 handovers) |
| Session has `last-screen.md` | 341 of 358 (95%) |
| No capture because the session left no table, list, link or path (`if (items.length)` gate) | 7 |
| Capture written after the load read it (SessionEnd raced SessionStart) | 21 of 340 loads (6%) |
| Last message, chars | p50 178, p90 1,312, max 7,159 |
| Last message is a short save or status note (under 700 chars, names handover, save, relay) | 165 of 348 (47%, heuristic, not hand-checked) |
| Final message of each of the last 2 typed-prompt turns, chars | p50 1,360, p90 2,572, p99 3,751, max 7,158; over 6,000: 2 of 355 |
| Today's "last 2 messages" misses one of those two turn-final messages | 44 of 355 (12%) |

What this says:
- Size is not the problem. Two turn-final messages fit in 6,000 chars 99% of the time.
- The unit is. Half the time the last message is "Handover saved, run /clear"; the answer is the
  turn before. "Last 2 messages" also catches interim narration from a long turn and misses the
  answer 12% of the time.
- Two delivery gaps lose about 8% of loads before any display question: the items gate and the race.

## Design

### 1. What is kept: the last 2 answered turns

A turn starts at a typed user prompt, a slash command, or one of cornerman's own prompts (a
relay-resumed session works under "Continue from the cornerman handover" with no typed prompt at all:
155 of 357 replayed sessions had only that one turn). Tool results, meta rows, compaction summaries
and sidechains do not start one. Harness text (a `<task-notification>`) and Stop hook feedback split
a turn into stretches without ending it; the turn keeps the finals of its last 3 stretches, oldest
first, so neither the reply to a hook nor the reply to a notification stands in for the answer.
Each turn carries the first 120 chars of its prompt. A turn cut off by the clear (its last row is a
tool call, not text) is marked.

Built as found 2026-11-28: the first version took only the final message of a turn, and a replay on
the previous session showed its answer replaced by a two-line reply to a Stop hook block.

### 2. Delivery gaps

- Read at load from the saving session's transcript (`<session>.jsonl` in the same folder as the
  new session's `transcript_path`), not from a SessionEnd file. The transcript is complete when
  `/clear` runs and lives on the same machine as the capture folder would, so this closes the race
  and the items gate in one path. Bounded by the trail reader's byte cap and 20,000 rows.
- The reply goes out as its own hook output: a third SessionStart command,
  `session-start-part reply`, fed through the same spool as part 2 and keyed by source, so the
  VS Code double start shows it once per start. It never competes with the handover or the rules
  for the 9,000-char budget.
- Cap: 6,000 chars of reply text. Over that, the head is kept and the block names the file.

### 3. How it reaches the user (decision D1)

The hook output reaches Claude, not the screen: a fresh-user test found the `systemMessage` line
missing after /clear in 3 of 3 tries. So Claude is asked to print it, the same way it prints the
opener line today (opener said in 272 of 309 loads, 88%).

### 4. Labels (decision D2)

The resumed Claude prints the stored text verbatim and puts a bold label before each part: Answer,
Why, Links, To paste, Question for you. It may split paragraphs between labels; it may not reword.

### 5. Kept out of the carry

The reply is assistant text and is never written to the rulings log, the handover body or the
trail. The next handover may mention it like any other context; it is not copied mechanically.

## Decisions (ruled 2026-11-28: the Recommended column, all four)

| ID | Question | Recommended (chosen) | Others |
|---|---|---|---|
| D1 | Where the user sees it | Claude prints it in its first reply after the opener line | VS Code opens `last-screen.md` in a preview tab on load (verbatim, no labels, VS Code only); both |
| D2 | Who labels it | The resumed Claude adds labels between verbatim parts | Labels made at save by rules (links, paths, code blocks as To paste, lines ending in ? as Question; the rest Answer; no Why); no labels |
| D3 | Which text | Final message of each of the last 2 answered turns, each under the prompt it answered | Today's last 2 messages; everything said since the last typed prompt |
| D4 | Which loads show it | Loads from a /clear or a relay (source `clear`) | Every load, with its age; only when the handover is under a day old |

## Replay of the build (2026-11-28, 357 saving sessions with a transcript)

| Measure | Result |
|---|---|
| Sessions that get a block | 357 of 357 |
| Block chars (instruction + prompts + text) | p50 3,019, p90 4,989, p99 6,746, max 6,929 |
| 6,000-char text cap hit | 3 |
| Newest turn cut off by the clear | 1 |
| Time to build one block | p50 26 ms, p99 149 ms, max 268 ms |

Every block is under the 9,000-char budget of one hook output.

## Test plan

Unit tests, written first (vitest):
1. Turn extraction from fixture transcripts: 2 answered turns; a harness turn inside a turn does not
   split it; the load prompt does not start a turn; a sidechain is ignored; a cut-off turn is marked;
   redaction applies; one typed turn gives one entry.
2. `last-reply.json` is written when the session left no table, list, link or path.
3. Load with no capture builds the reply from the transcript; with neither, no reply block and no
   error.
4. Three sessions' captures in one store: the load shows only the handover's own session's reply.
5. Every output (main, rules, reply) at or under 9,000 chars; a 20,000-char reply is cut at 6,000
   with the file named.
6. VS Code double start (startup + clear): one reply block per source, never two in one start.
7. Rulings: a session that resumes and saves again has the same rulings section as without the
   reply block.

Live check before merge (sandbox, `plugin-dev.mjs`): ask a question, get a long answer with a link
and a command, save, /clear. The first reply shows the opener, then the labelled answer, verbatim.
Before and after screenshots in the PR.

Field measures, added to `resume-check.mjs` and run with the #4221 rerun after the release:
- **E6 shown:** share of clear loads whose first reply holds at least 90% of the stored reply's
  non-blank lines (string match, no model). Today 0 by construction.
- **E7 cost:** reply chars added to context per load (expected p50 about 1,400, about 350 tokens,
  and about the same again in output).
- **E4 lost-answer corrections:** the class behind #4217; hand-read every hit.

## Release

Ships with #227 as 0.7.5, before the about 2026-12-05 rerun, so one rerun measures both.
