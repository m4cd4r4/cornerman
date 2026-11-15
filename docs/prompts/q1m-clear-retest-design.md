# Clear-arm retest design brief

Open this in a **fresh Claude Code session** in this worktree. Do not carry context from the session that wrote it.

## First action: rebase before doing anything else

This worktree was branched from `origin/research/quality-1m`. Before reading anything else:

```bash
git fetch origin research/quality-1m --quiet
git rebase origin/research/quality-1m
```

Push finished work to `research/quality-1m` (`git push origin HEAD:research/quality-1m`). This is the research branch, so no PR is needed.

## The problem

The quality-1m dial showed the clear arm (cornerman 0.7.2) losing chat-only rules after a handover: 4 and 7 of 14 chat tests passed, against 12 and 12 for natural. The fix is cornerman #211 (main d7c1445), which adds a per-session rulings log and one handover template shared by both paths. Macdara ruled that it is retested on NEW held-out chat rules, never the 14 the fix was designed against. On 2026-11-15 he also ruled: design first, spend later. This session builds the design and a dry check, and makes **no paid model call**.

## Source of truth (read these BEFORE designing)

1. [docs/research/quality-1m/TASK-DESIGN.md](docs/research/quality-1m/TASK-DESIGN.md): read from "Pilot 3 (chat layer" to the end, and above all "Clear-arm retest: design first (2026-11-15)".
2. [.claude/traces/2026-11-12-quality-1m-chat-layer.jsonl](.claude/traces/2026-11-12-quality-1m-chat-layer.jsonl): how the first 14 rules were built and reviewed.
3. [docs/research/quality-1m/task/harness/fork.mjs](docs/research/quality-1m/task/harness/fork.mjs), [arm.mjs](docs/research/quality-1m/task/harness/arm.mjs) and [dial-batch.mjs](docs/research/quality-1m/task/harness/dial-batch.mjs): the fork setup and the clear arm.
4. [docs/research/quality-1m/task/tools/check-rules.mjs](docs/research/quality-1m/task/tools/check-rules.mjs), [rule-negatives.mjs](docs/research/quality-1m/task/tools/rule-negatives.mjs), [mutants.mjs](docs/research/quality-1m/task/tools/mutants.mjs) and [score-run.mjs](docs/research/quality-1m/task/tools/score-run.mjs).
5. cornerman main d7c1445: `plugin/scripts/lib/rulings*` (or wherever #211 put the log), `nudge.mjs` and `carry.mjs`. Read them in a detached worktree; never install them into the live config (`rules/dev-environment.md`, plugin sandbox section).

If this brief contradicts those files, the files win.

## What's in scope

- 14 new chat rules. Each one needs a plant at cp12-29, a trigger at cp44-77, a hidden chat test and its mutants. None may restate or paraphrase the old 14.
- A separate reviewer agent checks the new rules, the same way the first 14 were checked. Its review is written to a JSONL trace in `.claude/traces/`.
- Harness changes:
  - a new base run from cp01 to cp43 with cornerman d7c1445 installed and the nudge off, so the rulings log captures each plant through UserPromptSubmit;
  - a fork point taken from that base;
  - the clear arm forking from it, pinned to d7c1445.
- A dry check with no model calls. It proves three things: the plants are delivered as user messages, the plugin's UserPromptSubmit hook logs them in the sandbox config, and the nudge stays silent before cp44 and fires at 250k after it.
- A cost estimate from measured figures: about US$12 for the base and about US$22 for 2 clear runs.
- A new section in TASK-DESIGN.md that holds all of the above, then a commit and a push.

## Out of scope (do NOT do)

- Any paid run: no base run, no clear run. Stop and report instead.
- Re-running the other arms. Their bases differ, so they are not comparable.
- Changes to cornerman itself. Put findings in cornerman `docs/CLAUDE-TODO.md` section 19.
- The frozen checkpoints cp01-80, except where a new plant or trigger must be added. If one is added, re-freeze through `tools/freeze.mjs` and say why.

## What "good" looks like

- Macdara can read one section and approve or reject a single figure in US$.
- Each of the 14 rules is checkable by script, held out from the fix, and spread across cp44-77 the way the old ones were.
- The dry check output is pasted into the section as evidence.
- The scoring plan compares new clear r1-r2 against the old clear runs (4 and 7 of 14), and is honest that n=2 is exploratory.

## Constraints

- Sonnet 5.5 for the runs, the same as the dial. Every spend needs Macdara's yes on the dollar figure.
- Multi-agent work writes a JSONL trace (`rules/agent-trace.md`).
- British English, no em or en dashes.

## Why this brief is structured this way

The first retest quote (US$25) missed two things. The new plants need a new base, and the rulings log only captures what passes through UserPromptSubmit, so a retest from the old fork could not test the fix at all. This brief puts both up front, so the design does not repeat that miss.