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
