# Handover Rulings Brief

Open this in a **fresh Claude Code session** in this worktree. Do not carry context from the session that wrote it.

## First action: rebase before doing anything else

```bash
git fetch origin main --quiet
git rebase origin/main
```

Main must be at 94f550e or later. Since this brief was scaffolded, main gained #207 (a window always gets its own handover after /clear; issues #204-#206), #185 and #208 (/cornerman:stats) and #209 (sidebar "This month" removed). Read the CHANGELOG section "0.7.3 (not released yet)" and the #207 diff before touching the save or handover path. Source line numbers below may have moved.

## The problem

Cornerman handovers drop what the user said only in chat. In the quality-1m fill dial (Sonnet, n=2, scores out of 37 hidden tests for cp44-80 and out of 14 chat tests), the clear arm, cornerman v0.7.2 with the nudge at 250k, scored worst:

| Arm | Hidden tests | Chat tests |
|---|---|---|
| natural | 31, 31 | 12, 12 |
| fill700 | 32, 32 | 12, 12 |
| fill900 | 28, 30 | 9, 9 |
| compact | 28, 31 | 8, 9 |
| clear | 23, 25 | 4, 7 |

The clear r1 handover (in the parked run's `cm-store/handovers/`, outside this repo; ask Macdara for the path if you need it) holds zero of the 14 rules that were given only in chat. It lists house rules that the repo already shows, the next action and a trail of tool calls.

Cause, as found 2026-11-15:

- `plugin/scripts/lib/nudge.mjs` `headlessAsk()` (about lines 264-270) asks only for the single next action and any open STOP question. It bypasses `plugin/skills/handover/SKILL.md`, which has "Decisions already made", "Do not" and "Decided, not yet applied".
- `plugin/scripts/lib/carry.mjs` carries open items from the PREVIOUS handover only, so the first clear in a chain carries nothing.
- `artifacts.md` is file paths only. The trail is tool calls. Nothing records what the user said.

Macdara ruled on 2026-11-15 at 13:25 AWST: build BOTH fixes below. In his words, the goal is to improve cornerman, not to finish the tests.

## Source of truth (read these BEFORE designing or coding)

1. `plugin/scripts/lib/nudge.mjs` (headlessAsk, the interactive ask, CHOICES, afterSave)
2. `plugin/skills/handover/SKILL.md` (the sections a handover should have)
3. `plugin/scripts/lib/carry.mjs` (what carries across a chain today)
4. `plugin/scripts/save.mjs` and `plugin/scripts/lib/run.mjs` (save path, headless runner chain)
5. `plugin/hooks/relay.ts` and `plugin/scripts/lib/hook.mjs` (relay mode and hook wiring)

If anything here contradicts those files, the files win.

## What to build

1. **One handover template for both paths.** The headless ask uses the same sections as SKILL.md, from one source, so nothing can drift. Also check whether the interactive relay ask skips the skill, and fix it the same way if it does.
2. **A per-session rulings log.** A hook records the user's decisions as they happen. You design how: capturing user messages on UserPromptSubmit, a lighter extraction, or something better. It must:
   - live in the cornerman store;
   - be carried into every handover and across the whole chain, including the first clear;
   - be bounded in size;
   - keep the user's own words where a ruling is quoted.

## Out of scope

- The quality-1m harness and task (`docs/research/quality-1m/` on branch research/quality-1m). Do not edit them.
- Release and marketplace publishing.
- Product page and README copy, beyond one CHANGELOG entry.

## What "good" looks like

- A headless clear on a session where the user gave rulings in chat produces a handover that lists them.
- The second and later clears in a chain still list them.
- The interactive `/handover` and the headless ask produce the same sections.
- The rulings log never grows without bound, and an empty log adds nothing to the handover.

## Required deliverables

1. A short design note in the PR body: how rulings are captured, stored, bounded and carried.
2. Tests first, using the repo's own runner, for both fixes. Any session-picking code needs a test with 3 sessions in one folder, written first.
3. A dry headless run in the sandbox showing a handover that contains planted rulings. Use NEW neutral fixture rulings, never the 14 quality-1m chat plants.
4. No new version bump: 0.7.3 is unreleased and on hold to batch with later changes (Macdara, 2026-11-15), and `plugin/.claude-plugin/plugin.json` already says 0.7.3. Add a user-terms entry to CHANGELOG "0.7.3 (not released yet)" in the same commit as the behaviour change. No test counts in release notes.

## Constraints

- Issue #210 (opt-in handover archive, Markdown per repo) is decided but not built, and out of scope here. Keep the rulings log a plain part of the handover record or a sibling under the store, so #210 can archive it later without a format change.
- Do not run the full local test suite (41-59 min here, with timeouts in untouched git-heavy tests). Run the test files you touch and let CI run the full suite.
- No real local paths in committed files: the leak-guard pre-push hook blocks them.

- One PR. Branch: `feat/handover-rulings`.
- Plugin dev rules (the maintainer's dev-environment rules):
  - run the plugin with `node ~/.claude/scripts/plugin-dev.mjs`;
  - never install a dev build into the live config;
  - use neutral fixture paths.
- No paid runs. The retest of the clear arm on NEW held-out chat rules costs about US$25 for n=2 and needs Macdara's separate yes.
- Do not tune on the 14 existing quality-1m chat plants.
- Merge and release need Macdara's yes. Plugin releases are batched and live-checked first.

## Out-of-scope follow-ups

Append them to `docs/CLAUDE-TODO.md`. Do not fix them inline.

## Why this brief is structured this way

The dial measured the headless path and found the defect. The fix must reach both paths from one template, or they will drift apart again. Fixtures must be new, or the retest only measures tuning to the test.