# Carry-forward fixes (five faults from the Test 1 batch) Brief

Open this in a **fresh Claude Code session** in this worktree. Don't carry context from another session.

## First action: rebase before doing anything else

```bash
git fetch origin main --quiet
git rebase origin/main
```

## The problem

Test 1 of the cornerman evaluation (8 seeds, 24 planted facts each, 3 chained clears) did not show
that cornerman carries everything forward: cornerman 159/192 acted on (82.8%), full context 184/192
(95.8%), plain `/clear` with no cornerman 11/192 (5.7%). cm minus full is -13.0 points, bootstrap 95%
[-36.5, +1.6]. The transcripts trace the gap to five product faults. None is fixed yet. Release 0.7.4
is on hold until they are fixed and a rerun shows the gap closed (Macdara, 2026-11-18).

## Source of truth (read these BEFORE designing or coding)

1. `git show origin/research/quality-1m:docs/research/cornerman-eval/PROJECT-PLAN.md`, sections "Test 1
   batch results", "Fix candidates for cornerman", "Floor arm results" and "Proof-read". This is the
   evidence. Read it whole; it is about 330 lines.
2. `plugin/scripts/lib/rulings.mjs` (the rulings log: line 142 holds "Some may be requests already
   done", line 143 the "older or plainer entries left out" trim).
3. `plugin/scripts/lib/carry.mjs` and `plugin/scripts/save.mjs` (what a save carries forward from the
   previous handover).
4. `plugin/scripts/lib/nudge.mjs` and `plugin/hooks/relay.ts` (the threshold ask, mid-turn form, and
   how the relay counts the clears it has left).
5. `plugin/skills/handover/SKILL.md` (what the writer is told to restate).
6. `test/rulings.test.mjs`, `test/carry.test.mjs`, `test/save-output.test.mjs` (existing tests; `npm test`
   runs vitest).

If anything in this brief contradicts those files, **the files win**.

## The five fixes

1. **Never trim rules from the rulings log silently.** When the log must shrink, drop requests that are
   already done, never standing rules. In seed 7, "23 calls a minute" was absent from the whole final
   session. The log was trimmed in all 8 chains by the last handover.
2. **Mark a superseded ruling as replaced, or drop it,** when a later ruling contradicts it. The log kept
   "MIT", "2 spaces" and "single quotes" unmarked next to their corrections (24 of 24 reversed facts).
3. **Frame the log as standing rules unless replaced,** not "may be requests already done".
4. **Writer check at save time.** If the previous handover restated N standing rules and this one
   restates far fewer, carry the missing ones forward, as "Carried forward" already does for open
   items. Seed 7's third handover wrote "Decided, not yet applied: None" and listed only the
   commit-message rules; seed 3 went from 5 of 11 restated keywords to 0 of 11.
5. **The mid-turn nudge must not drop the user's task when the relay has no clear left.** In seeds 4
   and 5 the context crossed the threshold on the first tool call of a turn. The agent saved a
   handover and ended with "Run /clear" having only read the file. The relay had used its 3 clears, so
   nothing cleared and the task stayed undone. With a clear left (seed 8) the relay cleared, carried
   on and the task was done. Either tell the agent to finish the user's request first and save after,
   or do not nudge mid-turn in that state. Pick one and say why in the PR.

## Fixtures

Build test fixtures from the real trials, with paths and ids neutralised (never real paths):

- Seed 7: the three handovers and the rulings log as loaded by the final session.
- Seed 4: the probe turn where the nudge fired ("Carry on with the migration script").

Sources: the Test 1 trial output directories `t1-cm-sonnet-s7-c3` and `t1-cm-sonnet-s4-c3` from the
eval host (location in the maintainer's private notes). The fixtures built from them are in
`test/fixtures/seed7-chain/`.

## What's in scope

- `plugin/scripts/lib/rulings.mjs`, `plugin/scripts/lib/carry.mjs`, `plugin/scripts/save.mjs`,
  `plugin/scripts/lib/nudge.mjs`, `plugin/hooks/relay.ts` only where fix 5 needs it,
  `plugin/skills/handover/SKILL.md`, and tests under `test/`.

## Out of scope (do NOT modify)

- `docs/research/cornerman-eval/test1/` on any branch: the rig is frozen. Do not sync anything to the VPS.
- Version bump, changelog release entry, marketplace: no release in this PR.
- The VS Code extension, the store packages, README copy.

## What "good" looks like

- Each fix has a test that fails on `origin/main` and passes on the branch. Write the test first.
- Fed seed 7's inputs, the final-session context contains every standing rule the first handover had,
  with superseded rulings marked or gone, and no wording that invites treating rules as done.
- Fed seed 4's turn with no clear left, the agent is not told to end its turn before the user's
  request is done.
- The log still has a size bound; say in the PR what it is and what gets dropped first.
- `npm test` passes whole. No new dependencies.

## Required deliverables

1. A short written plan (in chat) before code: for each fix, the function it lands in and the test.
2. Five failing tests, then the code, one fix per commit.
3. One PR, with an `## Evidence` section from `pr-evidence.mjs`, linking the PROJECT-PLAN sections.
4. A separate reviewer agent (Sonnet) on the diff before the PR is marked ready: multi-file change.

## Suggested workflow

1. Rebase. Read the source-of-truth list in order.
2. Run `/tdd`. Build the fixtures, write the five failing tests.
3. Fix 1 to 4 (log and writer), then fix 5 (nudge), committing each.
4. Run the plugin in the sandbox (`node ~/.claude/scripts/plugin-dev.mjs <this worktree>`), never the live
   config.
5. Reviewer agent, then PR. Merge needs Macdara's yes.

## Constraints

- One PR. Branch name: `fix/carry-forward-fixes`.
- Do not release. 0.7.4 stays held.
- Hook output must stay inside the existing hook budget; do not grow the SessionStart context without
  saying by how much.

## After the PR (capture, don't build here)

- Stage A: rerun the cm arm on seeds 1 to 8, unchanged fixture, predictions written before the run. This
  is a regression check only: the fixes were diagnosed from those transcripts.
- Stage B: fresh seeds 9 to 16, all arms, with Test 1b (harder plants, repaired step-4 probe). This is
  the run that can support the carry-forward claim.
- Tracking: Vikunja #4114 (This week).

## Why this brief is structured this way

The eval found faults in specific lines of the log and the nudge. The brief pins each fix to the trial
that showed it, so the tests reproduce real failures and the PR does not drift into a redesign.