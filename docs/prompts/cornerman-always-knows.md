# Cornerman: a window always gets its own handover after /clear

Open this in a **fresh Claude Code session** in this worktree. Do not carry context from the session that wrote it.

## First action: rebase before doing anything else

```bash
git fetch origin main --quiet
git rebase origin/main
```

## The problem

After `/clear`, a window should always resume the handover it just saved. Macdara: "It should not need to offer any; it should always know." Over the last 14 days it did not, 20 times.

Measured 12 Nov 2026 over every `/clear` in `~/.claude/projects/*/*.jsonl`, 29 Oct to 12 Nov: 290 clears, 270 loaded a handover, 20 lost one that was waiting.

| Cause | Count | Evidence |
|---|---|---|
| SessionStart hook cancelled | 14 | Transcript attachment `"type":"hook_cancelled"` on cornerman's (then clear-resume's) session-start, at about 10.6s. Timeout was 10s; 0.7.2 `hooks/hooks.json` has 20. Macdara's `/clear` fires 18-34 SessionStart hooks in parallel, and on 6-7 Nov all of them were cancelled at 20-34s, so 20s alone is not safe. A cancelled hook shows nothing, and the VS Code auto-resume still sends "Continue from the cornerman handover that was just loaded." |
| Handover filed for another repo | 3 | A solaisoft window ran `save.mjs --cwd C:/Scratch/azure-practice-exam-platform --unowned` (10-11 Nov). Macdara wanted a paste-ready prompt for another session, not a save. On the next `/clear`, `lib/hook.mjs` computes `elsewhere` only when this repo has zero waiting handovers; three stale solaisoft ones (49-55 days) suppressed it and were offered instead. |
| Unexplained | 3 | 30 Oct 04:14, 07:44, 10:58 UTC. Saved seconds before the `/clear`, no cancel, stayed waiting, archived hours later via the extension. Possibly a race between save and auto-resume. Find out. |

The analysis scripts are in `docs/research/handover-misses-2026-11-12/` on this branch (`clears.mjs`, `silent.mjs`, `where.mjs`, `cancelled.mjs`). Rerun them after the fix to show the before/after.

## Source of truth (read these BEFORE coding)

1. `CLAUDE.md` and the repo's contributor docs: plugin rules, tests, release flow.
2. `plugin/scripts/lib/hook.mjs` (or wherever `start()` lives on main): the session-start flow, `recentlyLoaded`, `elsewhere`, the twin-start echo.
3. `plugin/scripts/lib/select.mjs`: `chooseHandover`, `isFresh`, owner rules.
4. `hooks/hooks.json`: hook events and timeouts.
5. Closed PR #163 `fix/hook-sync-budget` ("a killed SessionStart hook no longer loses the handover") and merged PR #169 plus commit b43861c (single pull budget against the hook kill). Find out why #163 was closed before designing fix 1.

If this brief contradicts the code, the code wins. Paths above are from the installed 0.7.2 build; find their place in the repo.

## What's in scope (Macdara approved all four, 12 Nov)

1. **Second-chance load.** If SessionStart loaded nothing (cancelled, timed out or crashed), load this window's own waiting handover on the first UserPromptSubmit of the session. A cancelled start hook must stop being able to lose a handover.
2. **Faster SessionStart hook.** Measure where its time goes on this machine (pullFirst sync, ownerId process walk, store scan of 2,000+ records, git calls) and cut it. Keep the single-budget behaviour pinned by b43861c.
3. **Follow this window's handover across repos.** On `/clear`, this window's own fresh handover loads, or is named with one line saying where it went, wherever it was filed. Never offer other windows' stale handovers. Archive, do not list, anything past `maxAgeDays`.
4. **The handover skill picks the kind.** Work continues here after `/clear`: save, as today. Work continues in another repo or session: print a paste-ready prompt in chat, save nothing, the current session carries on. Ask once, with two options, only when the wording could mean either.

## Out of scope

- The relay, stats (#184/#185), sidebar and site pages.
- Store schema changes beyond what these fixes need.
- Any change to Macdara's live plugin install.

## What "good" looks like

- `/clear` after a save loads that handover every time, including when every SessionStart hook is cancelled.
- No `/clear` offers a list of weeks-old handovers.
- A handover filed for another repo is either loaded here or named in one line, never silently lost.
- Asking for a handover "for the other session" produces a prompt, and the session keeps going.

## Required deliverables

1. One GitHub issue per cause, then one PR (or one per fix if the risk splits them) with "Closes #N".
2. Tests first: a failing test for each cause, including a test with 3 sessions in one folder (rule: any code that picks a session needs it, written first). Fixtures use neutral paths.
3. A sandbox run with `node ~/.claude/scripts/plugin-dev.mjs <worktree> [--seed f] [--reset]`, with `--check` proving the live config is untouched. Reproduce a cancelled SessionStart (slow hook stub) and show the second-chance load.
4. Version bump in the same commit as the behaviour change.
5. The before/after numbers from rerunning the analysis scripts on sandbox transcripts.

## Constraints

- Branch `fix/handover-always-loads`. Public repo: issue per bug, squash-merge.
- Never install, reinstall or update a dev build into the live config; never point `CLAUDE_CODE_PLUGIN_DIRS` at this tree.
- Merge and release only with Macdara's yes. Releases are batched, never same-day follow-ups.
- Release notes say what changed for the user, never test counts.

## Out-of-scope follow-ups (capture, don't build)

Open a GitHub issue on m4cd4r4/cornerman for anything else you find.

## Why this brief is structured this way

The first diagnosis counted only sessions that showed "none loaded" and found 3 misses. Checking every `/clear` found 20, mostly silent. Measure against all clears, not the ones that complain.