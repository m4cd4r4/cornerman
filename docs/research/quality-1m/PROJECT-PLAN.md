# Quality at 1M: clearing vs filling vs auto-compact

Status: DRAFT, awaiting Macdara's sign-off on arms, n and spend. Nothing has run. No money spent.
Started 2026-11-09.

## Question

On a 1M-token Claude model doing a long coding job, is the work better when cornerman clears to a
handover than when the chat fills (Claude Code's default, which auto-compacts near full) or when
it is compacted earlier? If clearing helps, which threshold is best?

The hypothesis is that clearing helps. The test is designed so it can fail, and the article
publishes whatever it finds.

## What earlier work already settles (reuse, do not re-run)

| Result | Source | Use here |
|:--|:--|:--|
| Recall by fill, 50k-350k, 236 questions per arm | RESEARCH.md recall probe | Stage-1 evidence; extend only at 600k / 800k / 1M |
| Rules given only in chat: 11/12 with note vs 1.75/12 without | RESEARCH.md | Plugin-vs-nothing on rule carry-over; cite as is |
| Trail: 17/17 with vs 0/17 without; held-out 37/38 | RESEARCH.md | Cite as is |
| Cost per 30-item Sonnet build: relay US$9.08, auto-compact US$9.19, never US$9.66 | RESEARCH.md | Cost is settled; this test measures quality |
| 599k never-compacted session | _ab ledger | Seed to continue toward 1M instead of starting from zero (check it can be resumed first) |
| Ledger, frozen predictions + sha256, scorer self-tests | I:/Scratch/_ab/probes/ | Reuse the harness discipline |

## Dropped, listed briefly in the article

- Next-slice and T4 work tests: every arm ticked every item (ceiling), so they could not show a loss.
- Page-style judge: loosely specified LLM judge; claim already withdrawn.
- 450k recall point: 2 transcripts, n=28.
- Fixes tuned on the scored questions (oracle trail): upper bound only.

## Prior work (what others found)

- JetBrains, The Complexity Trap (arXiv 2508.21433, NeurIPS'25 DL4C): SWE-bench Verified, n=500.
  LLM summary was not reliably better than dropping old tool output; for Gemini 2.5 Flash
  (thinking) it cut solve rate 40.4% to 31.4%. Both halved cost. Contexts far below 1M.
- Factory, Evaluating context compression (Dec 2025, vendor): three production compaction methods
  all scored below 2.5/5 on recalling which files changed.
- Anthropic, Effective harnesses for long-running agents (Nov 2025): SDK compaction "not
  sufficient"; recommends fresh sessions with a progress file, git history and a failing-first
  feature list. Closest official match to cornerman. Qualitative.
- Anthropic, context management (Sep 2025, vendor): context editing +29% on an agentic-search eval.
- Anthropic, Opus 4.6 launch: MRCR v2 8-needle 76% at 1M (verified). 256k figure unverified.
- Cognition (Devin, Sonnet 4.5): capped at 200k inside a 1M window; model's own notes lost
  specifics. Cuts against self-written notes, no numbers.
- Nobody has published clear-vs-fill-vs-compact on coding at 1M, or an optimum threshold. This
  test would be new.

## Design

**Model and window.** Sonnet 5.5 with the 1M window, fixed for every arm (the model behaves
differently when it thinks the window is nearly full, so the setting must not vary). A 200k-window
model is a separate experiment and out of scope here.

**Arms** (thresholds fixed now, never tuned on results):

| Arm | What happens |
|:--|:--|
| Default | Nothing installed. The chat fills; Claude Code auto-compacts near full |
| Compact-250 | Auto-compact at 250k (verify the override env var works first) |
| CM-180 / CM-250 / CM-350 / CM-500 | cornerman relay, handover + clear at that size |

Compact-250 vs CM-250 separates the method from the threshold. Default vs the CM arms is
plugin vs nothing. The CM sweep finds the range.

**Task.** One long build, written for this test, long enough that every arm does more than
1.2M tokens of total work (so Default really reaches 1M):
- Checkpoints in sequence; every feature starts as failing (Anthropic harness pattern).
- Hidden end-to-end tests per checkpoint the agent never sees, plus regression tests on every
  earlier checkpoint (SlopCodeBench pattern).
- Rules given once, early, only in chat (naming, file layout, a banned API), checked mechanically
  on every later checkpoint.
- Calibrated in the pilot: late checkpoints must fail sometimes (target 40-80% pass in Default).
  A task that every arm passes is the old ceiling mistake.

**Primary metric.** Hidden-test pass rate on checkpoints done after the session's total work passes
350k tokens (the late segment, where arms differ), paired by checkpoint across arms.

**Secondary.** Regressions broken; chat-rule violations; artifact recall probes after each
handover or compaction (exact-match, which files changed and why); cost and wall time per run,
counting summary calls. Blind Opus pairwise review of the final repo is tertiary and reported
separately, never merged into the primary score.

**Statistics.** Paired bootstrap (B=10,000) 95% intervals per arm vs Default. Predictions,
thresholds, task and hidden tests frozen with sha256 before the first scored run. Scorer
self-tested on a known-good and a known-broken repo before use.

**Power.** With n=5 per arm only large effects show. A null result is reported as "no large
effect", never "no effect".

## Stages and cost (API-equivalent, rough until the pilot measures it)

| Stage | Runs | Estimate |
|:--|:--|:--|
| 0. Build task + hidden tests, self-test scorer | none | US$0 |
| 1. Pilot: Default and CM-250, 1 run each | 2 | US$60-120 |
| 2. Recall extension: 600k / 800k / 1M cuts | probe calls | US$20-40 |
| 3. Full: 6 arms x 5 runs | 30 | US$600-1,000 |

The pilot answers three things before the big spend: Default reaches 1M, late checkpoints can
fail, and the real cost per run. Stage 3 is re-costed from pilot numbers and needs its own yes.

## Publishing

- One article on macdaraomurchu.com (research section) with these results only; dead ends listed
  briefly.
- Linked from the cornerman product page and the GitHub README.
- The product page lede stays as is until results exist, then is rewritten from them.

## Rulings (Macdara, 2026-11-09)

1. Stage 1 pilot APPROVED: Default + CM-250 on Sonnet 5.5, 1 run each, capped at US$120.
   Stage 0 (task, hidden tests, frozen predictions) comes first, no spend.
2. Full test runs the SAME design on BOTH Sonnet 5.5 and Opus: 6 arms x 5 runs per model,
   60 runs. Opus is about 2.5x per run, so the full test is re-costed from pilot numbers
   (rough: Sonnet US$600-1,000 plus Opus US$1,500-2,500) and needs its own yes.
3. 6 arms, n=5 per arm.
4. Goal framing: the test may show clearing does not help; the article publishes either way.
