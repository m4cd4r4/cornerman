# Session-start context cap (faults 6, 7 and 8 from stage A) Brief

Open this in a **fresh Claude Code session** in this worktree. Don't carry context from another session.

## First action: rebase before doing anything else

```bash
git fetch origin main --quiet
git rebase origin/main
```

## The problem

Claude Code replaces any SessionStart hook output over 10,000 characters with a 2KB preview and a file
path ("Output too large"). cornerman emits the loaded handover and the rulings log as one output of 10
to 14KB, with the standing rules and the log at the end, so the rules are the part that is cut. In the
evaluation this hit 21 of 24 loads in Test 1 and 23 of 24 in stage A. The agent usually opens the file;
when it does not (Test 1 seed 7, twice) it works without the rules, and that seed scored 3 of 24.
Carry-forward must not depend on the agent choosing to open a file. Two smaller faults ride along.

## Source of truth (read these BEFORE designing or coding)

1. `git show origin/research/quality-1m:docs/research/cornerman-eval/PROJECT-PLAN.md`, sections "Stage A
   results" (faults 6, 7, 8) and "Cap measured for fault 6". This is the evidence.
2. `git show origin/research/quality-1m:docs/research/cornerman-eval/rig/spike/captest.mjs`: how the cap
   was measured (stub API, no model call). Reuse the method for your own check.
3. `plugin/hooks/hooks.json` (one SessionStart command today) and `plugin/scripts/session-start.mjs`
   with `plugin/scripts/hook-entry.cjs` (what is printed and in what order).
4. `plugin/scripts/lib/rulings.mjs` and `plugin/scripts/lib/carry.mjs` (the log render, the replaced
   marks from PR #217, the size bound).
5. `plugin/scripts/lib/nudge.mjs`, `plugin/scripts/stop.mjs` and `plugin/hooks/relay.ts` (the turn-end
   ask and how the relay's remaining clears are read; PR #217 fixed the mid-turn ask only).
6. Tests under `test/` that cover the above; `npm test` runs vitest.

If anything in this brief contradicts those files, **the files win**.

## Measured facts (2026-11-19, CLI 2.1.316)

- 10,000 characters arrive whole; 10,001 are cut. Characters, not bytes.
- The same cap for plain stdout and for JSON `additionalContext` (it counts the context text).
- The cap is **per hook output**. Three hooks of 7,000 each (21,000 in total) all arrive whole. When
  one hook is over and another under, only the one over is cut.
- Measured headless with source startup. The trials saw the same cut in the terminal app after
  `/clear`. Confirm it there in the sandbox before relying on it.

## The three fixes

1. **Fault 6: the context must arrive whole.** No single SessionStart output over 10,000 characters,
   ever. The measured route is separate hook outputs (for example the standing rules and rulings log in
   one, the handover in another), each with its own budget. Put the rules first within their part.
   Define what shrinks, in order, when a part alone is over its budget: finished task requests first,
   then state detail, never a standing rule without saying so. If something is left out, the context
   says what and where the full copy is, and tells the agent to open it before acting. Keep a margin
   under the cap and say in the PR what it is.
2. **Fault 7: the turn-end nudge must not ask for a /clear the relay cannot run.** In every stage A
   trial the final session crossed the threshold at a turn end with no relay clear left; the agent
   saved a fourth handover and wrote "type /clear", and nothing cleared. Decide what the turn-end ask
   should do in that state (a real user can still type /clear, the relay cannot) and say why in the PR.
3. **Fault 8: mark every replaced ruling, whatever the correction's wording.** The log marked "Use 2
   spaces" as replaced after "Actually make that 3 spaces", but left the old indent rule unmarked in 5
   of 8 trials where the correction was worded another way. Build fixtures from the real wordings: the
   reversed facts and their late corrections are in
   `git show origin/research/quality-1m:docs/research/cornerman-eval/test1/facts.mjs`.

## What's in scope

- `plugin/hooks/hooks.json`, `plugin/scripts/session-start.mjs`, `plugin/scripts/hook-entry.cjs`,
  `plugin/scripts/lib/rulings.mjs`, `plugin/scripts/lib/carry.mjs`, `plugin/scripts/lib/nudge.mjs`,
  `plugin/scripts/stop.mjs`, `plugin/hooks/relay.ts` only where fault 7 needs it, and tests under `test/`.

## Out of scope (do NOT modify)

- `docs/research/cornerman-eval/` on any branch: the rig is frozen. Do not sync anything to the VPS.
- Version bump, changelog release entry, marketplace: no release in this PR.
- The VS Code extension, the store packages, README copy.
- The handover skill's wording, unless a fix cannot work without it; then say so before changing it.

## What "good" looks like

- A test feeds session-start a handover plus a rulings log totalling 14,000 characters and asserts
  every emitted output is at or under the budget and that every standing rule is in one of them.
- A test with rules alone over the budget asserts the output names what was left out and where it is.
- Fault 7 and fault 8 each have a test that fails on `origin/main` and passes on the branch.
- A sandbox run (`node ~/.claude/scripts/plugin-dev.mjs <this worktree>`) with a real 12KB+ handover
  shows no "Output too large" in the session transcript after `/clear`.
- `npm test` passes whole. No new dependencies.

## Required deliverables

1. A short written plan (in chat) before code: for each fix, the function it lands in and the test.
2. Failing tests first, then the code, one fix per commit.
3. One PR with an `## Evidence` section from `pr-evidence.mjs`, linking the PROJECT-PLAN sections and
   stating the budget, the margin and the shrink order.
4. A separate reviewer agent (Sonnet) on the diff before the PR is marked ready: multi-file change.

## Suggested workflow

1. Rebase. Read the source-of-truth list in order.
2. Run `/tdd`. Write the failing tests.
3. Fault 6 first (it blocks the next evaluation run), then 8, then 7, committing each.
4. Sandbox check of the real cap, never the live config.
5. Reviewer agent, then PR. Merge needs Macdara's yes.

## Constraints

- One PR. Branch name: `fix/context-cap`.
- Do not release. 0.7.4 stays held; whether this ships alone as a patch is Macdara's call after merge.
- Hooks stay POSIX sh with the node check, as the existing ones are; each has a 10 second timeout.

## After the PR (capture, don't build here)

- Stage A rerun of the cm arm on seeds 1 to 8 with this build, predictions written first.
- Tracking: Vikunja #4119 (This week).

## Why this brief is structured this way

The evaluation measured the cap exactly and traced each fault to trials. The brief gives the numbers
and the trial evidence so the fix is sized to the real limit and tested against real wordings.