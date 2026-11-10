---
name: handover
description: Write a short handover for the current work so a fresh session (after /clear) picks it up automatically. Use for '/handover', 'write a handover', 'hand this off', 'save my place before I clear'.
allowed-tools:
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/save.mjs" *)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/load.mjs" *)
---

# handover

Write a handover a fresh session can act on without this conversation, then save it.
After the user runs `/clear`, the plugin's SessionStart hook loads it for them.

## 1. Check the facts first

Run these rather than recalling them. A handover with a wrong branch or a stale
"next step" costs the next session more than it saves. Run them where you are,
without a `cd` first: a `cd` before a git command asks the user for approval.

```bash
git branch --show-current
git status --short
git log --oneline -5
```

## 1b. Carry forward what is still open

A handover that narrows to the next step loses work that is settled but not yet done. Before
writing, gather every key point that affects what to do next:

- Rulings the user gave this session, and any decision log or review page the session touched.
  List each one with no evidence it was applied. Do this even if the next action is a different item.
- Work already built but not applied or fully tested (a trimmed file, a draft branch), and where it is.
- Questions shown to the user for a choice with no answer recorded, and where the options live.
- A progress measure, if the goal has one: start, now, target (`490 -> 483, target ~0`).
- Other handovers on the same task (same task words or files): run
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/load.mjs"` (no name: lists waiting ones) to see waiting ones, and `--peek <file>` to read
  one. Fold their unfinished items in, or name them under "Also read".
- The handover you were started from, if any: compare its open items (decided, built, open questions,
  progress) with yours. Anything that dropped out without being done is carried forward, or stated as
  done or dropped. Never let an item disappear silently.

## 2. Write it

Aim for under 40 lines.

Write for someone who has never seen this project. The next session has none of
this conversation and none of your reasoning, so every reference has to stand on
its own: name files by path, name decisions by what was decided rather than "as
discussed", and never say "the usual place" or "the file we changed".

`Next action` comes second, straight after the goal, because it is the line that
gets read first and acted on.

```markdown
# <title>

## Goal
One or two sentences: what this work is for, and what "done" means.

## Next action
The single first thing to do, concrete enough to run: a command, or a file:line
and the change to make there. Not a topic to look into.

## Progress
Only when the goal has a number: start, now, target. Carry the start and target forward from the
previous handover.

## State
- Branch, last commit, PR number if there is one.
- Done and verified, with how it was verified (the command, and what it printed).
- In progress, uncommitted, or unverified. Say which.

## Decided, not yet applied
Rulings the user has made that are ready to apply, one per line, with where they are recorded.
If a decision record is named, say how many items it holds. Write "None" if the list is empty.
This is work to do, not background: the next session applies these, not only the next action.

## Open questions
Anything shown to the user for a choice with no answer recorded, and where it lives. Write "None"
if there are none.

## Also read
Other handovers or records on the same task, and what each still holds open.

## Decisions already made
Choices the user settled that the next session must not reopen. One line each,
with the reason if the decision looks arbitrary without it.

## Do not
Traps, approaches already tried and failed, anything off-limits. Say what happened,
so it is not retried in a slightly different form.

## Key files
- path/to/file - why it matters
```

Do not write a "Recent trail" section. Saving adds one from this session's own tool calls (the last
files written, edited and read, and the last commands that succeeded and failed), and replaces any
you wrote, so it is exact. `CORNERMAN_TRAIL=0` turns it off.

Leave out sections that would be empty, except "Decided, not yet applied" and "Open questions",
which always appear (say "None"); an empty heading costs the reader a stop.
Do not include secrets, tokens or passwords: the file is plain text on disk.

## 3. Save it

Pass the handover on stdin with a short title. Use a quoted heredoc so `$` and
backticks in the text are kept as written:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/save.mjs" --title "<short title>" <<'EOF'
<the handover markdown>
EOF
```

Run it exactly in this form: one command, the heredoc, nothing chained before or
after it. This skill pre-approves the plugin's own save.mjs and load.mjs, so the save
runs without a permission prompt. Do not write the handover to a temporary file
and redirect it with `<`, and do not add a `cd`: either one makes the user approve
it by hand.

It saves one JSON record under `~/.cornerman/handovers/`. Saving again archives only this
window's own earlier handover, never another window's, so two windows on the same branch each
keep their own waiting handover.

With `CORNERMAN_WEB=1` set (for Claude Code on the web), it also pushes
`.cornerman/HANDOVER.md` to its own branch, `cornerman/<branch>`, leaving the
current branch untouched, so the next cloud session can find it. That session lists it
with the command that prints it; it does not load it automatically. If the output says
the push failed, tell the user: the handover is saved on this machine, but a new cloud
session will not see it.

## 4. Tell the user

One line: the handover's title, and that running `/clear` now will load it in the fresh session.
If a cornerman nudge this session said the relay is on, say instead that the relay clears
and continues when this turn ends, and end the turn with no further tool calls.

To read a waiting handover without taking it from its window, use
`node "${CLAUDE_PLUGIN_ROOT}/scripts/load.mjs" --peek <file>`; `--take` moves it here.
