# Stage 0: task, hidden tests, scorer (design)

Status: DESIGN, 2026-11-09. Nothing built, nothing run, US$0 spent.
Parent: PROJECT-PLAN.md (arms, metric, rulings).

## Early checks (done 2026-11-09)

- **Compact-250 override exists.** Claude Code 2.1.316 reads `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` and
  `CLAUDE_CODE_AUTO_COMPACT_WINDOW`. Use `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=25`: the earlier value 18
  compacted at 176.8k and 177.6k (RESULTS.md, compact200). `CLAUDE_CODE_AUTO_COMPACT_WINDOW` at 200k
  or 300k compacted at 78k both times; do not use it. Confirm 25 lands near 250k in the pilot's
  smoke step (one forced fill, a few cents) before any scored run.
- **The 599k session cannot seed this test.** It was Opus (`claude-opus-5-5`) on the 30-item site
  build, the ceiling task the plan drops. Wrong model for the Sonnet pilot and wrong task. Every
  arm starts from the same empty repo.
- **CM arms need no new runner.** `plugin/scripts/run.mjs --nudge-at N` runs the headless relay at
  any threshold (180000 / 250000 / 350000 / 500000).

## Lessons this design is built around

From I:/Scratch/_ab (METHODS-LEARNINGS.md, long-ab-plan.md, quality-t5-design.md):

1. Context only grows when the work makes many small iterations over real files. Spec-dump tasks
   (one big write) never reached large context. So: many checkpoints, each small, each touching
   existing code.
2. Every earlier work test hit the ceiling (T4, T5, T7, next-slice). Discrimination has to come
   from strict hidden tests on details stated once, and from changes that can break earlier work.
3. CM arms run with a realistic config floor (the trim profile, about 46k, measured by a smoke
   reply before the run), never an empty config. Default gets the same config.
4. The scorer is proven on a known-good and a mutated repo before any paid run.
5. Hard per-call budgets, rep in every result key, infra failures recorded as INVALID and rerun by
   key, every paid call booked before grading.

## The task: a spreadsheet engine, revealed one checkpoint at a time

**Why a spreadsheet engine.** Zero-dependency Node, deterministic, fast to test. Every feature goes
through the same parser, evaluator and dependency graph, so late features can break early ones
(regressions are possible, unlike independent site pages). The model knows spreadsheets well, so
the spec deliberately departs from Excel in stated places: the hidden tests check those
departures. A model working from its prior instead of the spec fails them.

**Gated reveal.** The repo starts with a stub, a `FEATURES.md` list of 40 checkpoint titles (all
unticked, all failing), and `node gate.mjs`. The agent runs `node gate.mjs next` to get the next
checkpoint. The gate:
- refuses until the current checkpoint's visible tests pass;
- prints the next checkpoint's spec to stdout only (the agent may save it; the harness does not);
- writes that checkpoint's visible tests into `test/visible/`;
- snapshots the working tree (outside the repo) and logs checkpoint index, wall time and the
  session id, so every checkpoint maps to a point in each arm's token trail.

The spec living in chat, not in a file, is the point: Default holds every spec in context;
a CM arm keeps only what its handover or the repo carries. That cuts both ways, so the test can
fail in either direction.

**Checkpoint outline (40, specs and tests written in Stage 0):**

| Block | Checkpoints | What they add |
|:--|:--|:--|
| A. Core | 1-8 | Cell store, literals, A1 refs, arithmetic with stated precedence, errors and their stated priority order, recalculation |
| B. Graph | 9-14 | Dependency graph, cycle detection with a stated error, ranges, named ranges, incremental recalc, recalc order log |
| C. Functions | 15-22 | SUM/AVG/MIN/MAX, stated rounding (half-even), IF and short-circuit, text functions, a custom date serial from a stated epoch, lookup |
| D. Structure | 23-30 | Insert/delete rows and columns with reference rewriting, copy-paste with relative/absolute refs, undo/redo, CSV import/export with stated quoting |
| E. Cross-cutting | 31-40 | Refactors that touch everything: a second sheet and cross-sheet refs, a rename of the public API, a change to the error order, persistence format v2 with migration, a performance budget on 10k cells |

Late checkpoints are the ones that can fail: they need early decisions (the error order, the
rounding rule, the API names) and they rewrite code the early checkpoints depend on.

**Rules given once, in the start prompt only** (checked mechanically on every snapshot):
1. No `eval`, `new Function` or `vm` anywhere in `src/` (the tempting shortcut for a formula engine).
2. Every file under `src/` stays under 300 lines.
3. Every file under `src/` starts with the line `// <file name>: <what it is for>`. (Replaces an
   error-shape rule: the cp02 spec already states the shape, so it was not chat-only.)
4. Visible test files are never edited (hash-checked against what the gate wrote).
5. Commit after each checkpoint with message `cpNN: <title>`.

**Recall probes.** At checkpoints 15, 25 and 35 (arm-independent positions) the gate asks the agent
to append answers to `PROBES.md` before continuing: which checkpoint introduced a stated detail,
the value of a rule, which files the last refactor changed and why. Exact-match, scored by script.

## Scoring

**Per checkpoint k (primary):** the hidden tests for k, run against the snapshot taken when the
agent asked for k+1 (or the final tree for the last one). Pass = all hidden tests for k pass.
A checkpoint never reached scores fail and is also reported as not reached.

**Late segment.** Checkpoints from index K onward, K = the first checkpoint the Default pilot
requests after its cumulative context passes 350k. K is fixed from the pilot and frozen with
sha256 before Stage 3; the pilot itself is calibration, not a scored result. Target: K <= 20, so
the late segment has 20+ checkpoints. If Default's late pass rate in the pilot is outside 40-80%,
the task is retuned (harder or easier hidden tests on late checkpoints) and re-frozen before
Stage 3. Retuning happens only on Default pilot data, never after a CM arm is scored.

**Secondary:** regressions (all hidden tests for checkpoints 1..k-1 on the final tree), rule
violations per snapshot, probe accuracy, cost and wall time per run including summary calls.

**Scorer self-test (before any paid run):**
- Known-good: a reference implementation written in Stage 0 passes every hidden test, every rule
  and every probe check.
- Known-broken: 10+ mutants of the reference (one per category: wrong rounding, wrong error order,
  eval used, file over 300 lines, edited visible test, broken undo, a regression in block A
  introduced in block E). Each must fail exactly the check it targets.
- The scorer runs from outside the repo and refuses a tree with `test/hidden/` present.

## Build order (Stage 0, all US$0)

1. Specs for checkpoints 1-40, with each stated departure from Excel listed.
2. Reference implementation, built checkpoint by checkpoint against the specs (this also proves
   each spec is buildable in order).
3. Visible tests (small, the gate writes them) and hidden tests (strict, kept outside the repo).
4. `gate.mjs`, snapshotter, scorer, rule checker, probe checker.
5. Mutants and the scorer self-test.
6. Predictions written, then task + tests + scorer + predictions frozen with sha256.
7. Smoke: one free dry run of the gate against the reference to prove the reveal order.

## Progress (2026-11-09)

Built and passing, all under `task/`, US$0:
- `checkpoints/cp01-cp08`: spec, visible and hidden tests (block A). The reference passes all 52.
- `reference/src`: block A engine, 7 files, no eval.
- `tools/check-tree.mjs`: runs checkpoint tests against any tree, in a fresh copy.
- `tools/mutants.mjs`: 8 mutants (Excel-style number grammar, unary above power, empty ref as
  null, leftmost error, half-up rounding, case-sensitive text, % below ^, no tolerance). All 8
  killed by their target checkpoint.
- `harness/gate-server.mjs` + `starter/gate.mjs`: local HTTP gate, state in the run dir so it
  survives clears. `harness/smoke-gate.mjs` passes (stub refused, reference walks every gate,
  one snapshot per checkpoint, visible hashes recorded, ALL DONE, status done).
- Fixture files carry a `tdd-guard:allow` header (acceptance fixtures, proven by the mutants).

Rules found while building:
- **Backward compatible.** Every later checkpoint keeps every earlier hidden test passing (API
  rename keeps old names as aliases; the error-order change is opt-in). Otherwise "regression"
  would punish following the spec.
- `node --test <dir>` fails on Node 25; always pass a glob (`"test/**/*.test.mjs"`).

Draft titles for 9-40 (specs not written; revise freely until the freeze):
9 cycles (#CYCLE!, top priority); 10 precedents/dependents; 11 incremental recalc (only
dependents re-evaluate); 12 recalc order log (topological, row-major ties); 13 function syntax +
SUM over ranges; 14 named ranges; 15 AVERAGE/MIN/MAX/COUNT with stated empty and text rules
(probe 1); 16 ROUND half-even with digits, ROUNDUP/ROUNDDOWN; 17 IF short-circuit (untaken branch
errors ignored), AND/OR/NOT; 18 text functions, 1-based MID, stated TRIM; 19 DATE serial from
epoch 2000-01-01 = 1, YEAR/MONTH/DAY; 20 ISERROR/IFERROR; 21 exact-only VLOOKUP with #N/A placed
in the order; 22 SUMIF criteria grammar; 23 insert rows; 24 delete rows (refs to deleted cells
#REF!); 25 insert/delete columns (probe 2); 26 $ absolute refs + copy with relative rewrite;
27 undo/redo; 28 CSV export with stated quoting; 29 CSV import; 30 JSON save/load v1;
31 workbook + Sheet2!A1; 32 cross-sheet cycles and recalc; 33 API v2 names, v1 kept as aliases;
34 opt-in Excel error order; 35 persistence v2 + migration from v1 (probe 3); 36 performance
budget, 10k-cell chain; 37 sheet rename rewrites refs; 38 canonical formula text; 39 explain(addr)
trace; 40 CHANGES.md, one line per checkpoint, checked.

Built after block A:
- `starter/FEATURES.md` (40 unticked titles) and `harness/START-PROMPT.md` (the five rules).
- `tools/check-rules.mjs` + `tools/rule-negatives.mjs`: 16 cases, each rule 1-4 caught alone, and
  no false hit on eval in a comment, an `evaluate(` call, a 299-line file or an own test file.
  Rule 5 proven by the gate smoke run (missing cpNN commits caught).
- `tools/check-probes.mjs` + `harness/probes.json` (key, never copied into the run repo) +
  `tools/probe-selftest.mjs`: right answers in varied formatting 6/6, wrong 0/6, absent 0/6.
  `git-files` answers are keyed from the run's own history. Probe 1 holds block A questions only.

Block B (cp09-16) built:
- Specs: cycles (#CYCLE! per member, top priority, static dependencies), precedents/dependents,
  incremental recalc (same input marks nothing), recalc order log (row-major Kahn, cycle groups),
  function syntax + SUM (range vs direct arguments, no text coercion, 10,000-cell limit, ranges
  only inside functions), named ranges, AVERAGE/MIN/MAX/COUNT (MIN/MAX of nothing #VALUE!, COUNT
  never counts booleans), ROUND family (half-even on the shortest decimal form).
- Reference grows to 11 files (largest index.mjs, 184 lines); every block A hidden test still
  passes: 125 hidden + 25 visible tests over cp01-16, all green.
- 26 mutants (8 block A + 18 block B, Excel-prior ones first), all killed by their target.
- Probe 1 now 10 questions; two block A questions were swapped because FEATURES.md titles gave
  the answer away.
- Smoke gate walks all 16; rule negatives still 16/16 (one case no longer keys on header text).

Block C (cp17-24) built:
- Specs: IF (lazy branches, static dependencies), AND/OR (no short-circuit, range vs direct
  arguments), NOT; text functions (display-text conversion, TRIM ends only); dates (serial 1 =
  2000-01-01, no rollover); ISERROR/IFERROR (#CYCLE! never caught); VLOOKUP (exact only,
  type-strict, column outside the table #REF!); SUMIF (operator grammar, type-strict, no
  wildcards, `<>` = complement of `=`, same-shape sum range); insert rows and delete rows
  (token-wise formula rewriting, corners move independently, #REF! for lost refs, #FULL, #ARG,
  names move/shrink/are removed, full re-evaluation after).
- Reference grows to 16 files (args, logic, text, dates, lookup, structure; index.mjs 204 lines);
  188 hidden + 37 visible tests over cp01-24, all green.
- 62 mutants (36 new, Excel-prior ones first), all killed by their target.
- Smoke gate walks all 24; rule negatives and probe self-test unchanged and passing.

Block D (cp25-32), built:
- Probe P2 (10 questions; self-test right 20/20, wrong 0/20, absent 0/20); cp25 insert and
  delete columns (refs.mjs, axis-generic structure); cp26 `$` refs + copy (copy.mjs); cp27 undo
  and redo (history.mjs, limit 100, no-op calls not recorded); cp28 CSV export (LF, no trailing
  line end, stated quoting); cp29 CSV import (strict #CSV with 1-based record number, refs not
  shifted by `at`, one undo step); cp30 save and `loadSheet` (persist.mjs, exact JSON text,
  canonical keys and targets only, #LOAD with the failing key); cp31 workbooks and `Name!A1`
  references; cp32 cycles, precedents/dependents, incremental recalc and `recalc()` across sheets.
- cp31-32 as built (fixture designer's calls, not yet reviewed by Macdara):
  - `createWorkbook()` starts with no sheets. Sheet names follow the defined-name rule
    (checkpoint 14), so `Sheet2` is invalid; spec examples use `Data`, `Main`. `#BADNAME` /
    `#SHEET`. No spaces around `!`; the sheet name is written once per range
    (`Data!A1:Data!B2` is #PARSE!).
  - References resolve by name at evaluation: unknown or removed sheet = `#REF!` (own cell),
    re-resolved on add. A range on a missing sheet is #REF! even inside COUNT. Errors keep their
    own unqualified cell. A removed sheet keeps working on its own (no workbook).
  - Row/column ops never rewrite a sheet-named reference, even one naming its own sheet (marked
    "This is NOT what Excel does"). Copy shifts them; a reference copied off the sheet becomes
    `#REF!` with its sheet name (found while writing the tests: the first version left
    `Data!#REF!`, which does not parse).
  - Labels: own cells plain first, then `Name!A1` by sheet creation order. `recalc()` returns
    own cells only, ordered through paths on other sheets; a removed sheet re-evaluates all its
    formulas on next read.
- Reference refactor: engine.mjs holds the graph, cache and sheet registry keyed
  `<sheetId>|<addr>`; sheet.mjs is the sheet (296 lines); workbook.mjs; index.mjs re-exports.
  Every file under 300 lines.
- 141 mutants at cp32 (14 for cp31, 11 for cp32). Six older mutants had stale find text after
  the cp27 and cp31 changes (two silently, since cp27); rewritten and killed. Full suite run
  after cp32: 141/141 killed.
- check-tree cp01-32 all green; smoke gate OK.

Next in Stage 0: block E (cp33-40) with the same loop; fill probes 2-3 as their blocks land;
then wire the probe prompt into the gate after cp15, cp25 and cp35 (refuse `next` until
PROBES.md has a line per question; record tokens since the last clear per probe). Known
performance debt for cp36: valueOf recurses (deep chains) and cycle detection is a full pass
after each graph change.

## Open

- Checkpoint sizing is a guess. If the Default pilot finishes all 40 under 1M context, the task is
  too short; extend block E before Stage 3, not after.
- Probes at fixed checkpoints may land just after a CM clear in one run and mid-session in another.
  Record, per probe, tokens since the last clear or compaction, and report probe accuracy against it.
