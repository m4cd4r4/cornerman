# Stage 0: task, hidden tests, scorer (design)

Status (2026-11-12, 16:50 AWST): built, two pilots run, re-frozen after the fix and retune. The
task is at the ceiling for Default, so the comparison as frozen is not run. Macdara rejected the
reframe (REFRAME-DRAFT.md is not approved) and asked for a test that is hard enough for the
question. The redesign is "Chat-only layer" at the end (design, not built). The text below is the
design history from 2026-11-09 on.
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

Block E (cp33-40), design (fixture designer's calls, not yet reviewed by Macdara):
- cp33 API v2: new names beside the old ones, old names stay as aliases. `setCell` (= set),
  `value` (= get), `text` (= display), `addresses` (= cells), `formula` (getInput but `""` for an
  empty cell, not null), `setMany(object)` (several cells as one undo step; every address checked
  first, any bad one throws #ADDR and nothing is applied). `book.get(name)` = `book.sheet(name)`.
- cp34 opt-in error order: `createSheet({ errorOrder: "first" })`, same option on createWorkbook
  and loadSheet. "first" = the error met first in reading order (left operand, then right; arguments
  left to right; ranges row-major) wins instead of the priority list. #CYCLE! on a cycle member is
  unchanged. Default "priority". Any other value throws #ARG. A workbook's sheets share its order.
- cp35 save v2: `book.save()` = {format:"workbook",version:2,errorOrder,sheets:[{name,cells,names}]}
  exact text; `loadWorkbook(text)` accepts v2, and migrates a v1 sheet save into a one-sheet
  workbook named `Sheet_1`. #LOAD with a stated check order and cell paths ("sheets.0.name").
  `sheet.save()` stays v1. Probe P3 after cp35.
- cp36 performance: a 10,000-formula chain (A1..A9999, B1) reads in budget with no stack overflow;
  changing A1 re-evaluates exactly the 10,000; 2,000 set/get pairs on a 10k sheet in budget (so
  no full cycle pass per change). Reference: depth-limited lazy evaluation that unwinds and
  resumes, and cycle membership memoised per node, dropped with the cache.
- cp37 `book.renameSheet(old, new)`: rewrites `Old!` in every formula of every sheet in the book
  (case-insensitive match, written as the new name is typed), formulas naming the new name start
  resolving, case-only rename allowed, #BADNAME/#SHEET as addSheet, unknown old = #SHEET.
  Not undoable: it clears every sheet's undo and redo lists.
- cp38 `sheet.canonical(address)`: the formula printed from its parse: upper case, no spaces,
  shortest number text, minimal parentheses by the stated precedence, string literals kept as
  typed. Non-formula input returned as is, empty = "", unparseable formula returned as typed.
  set(canonical) gives the same value. (Settled when built: `$` kept, unary `+` kept, numbers
  normalised from the typed digits so no float or exponent text appears.)
- cp39 `sheet.explain(address)`: { address, input, value, from: [...] }, from = direct
  precedents in precedents() order and labels; each cell expanded once (depth-first, pre-order),
  later repeats have from: null.
- cp40 CHANGES.md at the repo root: one line per checkpoint 1-40 in order, `- cpNN: <text>`,
  text 1-120 chars. Checked by a hidden test (check-tree copies CHANGES.md beside src/).

Block E progress (2026-11-09):
- Built cp33 (api2.mjs), cp34 (errors.mjs withErrorOrder + errorOrderOption), cp35 (bookio.mjs
  loadWorkbook; workbook.mjs buildWorkbook + book.save; persist.mjs split into parseDoc /
  parseBody / parseSheetDoc so v1 and v2 share the per-sheet checks, v1 cells unchanged).
- Mutants: cp33 6, cp34 6 (two equivalent ones dropped: the order is set on every evaluation and
  a workbook sheet takes its order from the engine it is bound to), cp35 15; all killed. Two older
  mutants had stale find text after cp34/cp35 (`removed-sheet-still-bound`,
  `load-names-before-cells`); repaired and killed. 168 mutants.
- Probe P3 (10 questions) filled; probe self-test right 30/30, wrong 0/30, absent 0/30.
- Gate: after cp15, cp25 and cp35, `next` refuses until PROBES.md has a non-empty line per
  question; it shows id + ask only, says to answer from memory and notes without running code
  (fixture designer's call), copies PROBES.md to `<run>/probes-<id>.md` when answered, and logs
  `probe-asked` / `probe-answered` for the token join. The scored snapshot stays the first passing
  tree. Smoke gate walks the three stops (partial answers refused, no answer leaks).
- FEATURES.md cp34 title was "optional Excel error order"; the spec never says Excel, now
  "optional reading-order errors".
- This doc had a full copy of itself pasted into the cp38 bullet in a12f93e; cut, and the few
  words it replaced are marked in that bullet.
- check-tree cp01-35 green; smoke gate OK.

- cp36 (engine.mjs): nested reads deeper than DEPTH_LIMIT 100 unwind to the top-level read and
  resume; cycle membership memoised per node and dropped with the cache. Chain Z1 + A1..A9999 + B1
  (rows stop at 9999); budgets 2 s chain read, 3 s for 2,000 set/get pairs. 7 mutants.
- cp37 (workbook.mjs renameSheet, refs.mjs renameRefs, engine.rename, history.clear): check
  order unknown old -> #SHEET, invalid new -> #BADNAME, taken -> #SHEET; exact same name is a
  no-op that keeps undo; a removed sheet is not rewritten. 14 mutants.
- cp38 (canonical.mjs; parser keeps the typed text of number and reference tokens): hidden tests
  include 1,500 generated formulas checked for same value, idempotence and no spaces. 18 mutants.
- cp39 (explain.mjs): addresses are labelled from the sheet `explain` was called on; each node's
  children come in the order its own sheet's precedents() gives. Iterative walk; a recursive
  mutant dies on the 9,999-deep chain test. 7 mutants.
- cp40: reference/CHANGES.md; check-tree, mutants.mjs and smoke-gate copy it beside src/. Rules
  beyond the design line: `#` and blank lines ignored, no leading/trailing space, a text equal to
  the FEATURES.md title fails, no duplicate texts. 8 mutants.
- sheet.mjs kept under 300 lines (row/col methods and display/cells/stats became one-liners);
  `redo-kept-on-record` find text made unique after history.clear(). 222 mutants.
- Block E done: full mutants.mjs run 222/222 killed, check-tree cp01-40 green, smoke gate OK.

## Open

- Checkpoint sizing is a guess. If the Default pilot finishes all 40 under 1M context, the task is
  too short; extend block E before Stage 3, not after.
- Probes at fixed checkpoints may land just after a CM clear in one run and mid-session in another.
  Record, per probe, tokens since the last clear or compaction, and report probe accuracy against it.

## Fixture decisions (settled 2026-11-09)

Macdara delegated these (2026-11-09 21:13 AWST, "make the decisions on my behalf"); Claude kept
every one as built: the rename-to-same-name no-op that keeps undo (cp37), explain labels relative
to the sheet it is called on (cp39), the extra CHANGES.md rules (cp40), probe answers from memory
without running code, and the scored snapshot = the first passing tree. He may revisit any of them;
a change after the pilot is a retune and re-freezes PREDICTIONS.md.

## Stage 1 tooling (2026-11-09)

- `tools/score-run.mjs` + `tools/tokens.mjs`: one run's score (per checkpoint, late segment,
  regressions, rules, probes, work tokens). `tools/score-selftest.mjs` 16/16 on the reference
  smoke run and a broken copy.
- `harness/arm.mjs`: setup / smoke / run / score for one arm under I:/Scratch/_q1m/<name>.
  Smoke: floor 46,736 (Default) and 46,882 (CM-250), window 1,000,000.
- `tools/freeze.mjs`: sha256 manifest `task/frozen.sha256.json`, written before the pilot.

## Pilot 1 result and the extension (2026-11-09)

Default pilot (Sonnet 5.5, default-sonnet-r1): all 40 checkpoints in 31 minutes, one session, no
compaction, peak and work 414,151 tokens, US$7.19 API-equivalent. Hidden: 35/40 checkpoints pass
(fails cp06, cp13, cp21, cp36, cp39), 0 regressions, 0 rule violations, probes 29/30. So the task
is too short (never near 1M) and near the ceiling. Tokens per checkpoint grew from about 10k
(cp01-31) to about 16k (cp31-40) as the code grew.

Decision (Claude, under Macdara's delegation): extend to 80 checkpoints, cp41-80, five blocks of
eight, written with the same discipline (spec, reference, visible, strict hidden tests, mutants
killed, every earlier hidden test still green). Aim: Default work past 1.2M, late pass 40-80%.
To pull pass rates down, each new checkpoint states 2-3 rules once that differ from the obvious or
Excel behaviour, and its hidden tests also exercise how it meets earlier features (undo, insert
and delete, rename, save/load, workbooks, error priority, display). cp40's test is relaxed so
lines for cp41+ may follow in order; every later checkpoint adds its CHANGES.md line.

Outline (titles go into starter/FEATURES.md; specs may refine them):
- Block F, cp41-48: 41 number formats on display (`0.00`, `#,##0`, `0%`, stated rounding);
  42 cell notes (moved by insert/delete/copy, kept by undo, saved); 43 COUNTIF and AVERAGEIF
  (cp22 criteria); 44 INDEX and MATCH (stated match types); 45 SUMPRODUCT (same-shape rule);
  46 data validation (whole number, list; set() refuses with a stated error); 47 merged ranges
  (reads of covered cells, insert/delete through a merge); 48 sort a range by a column (stable,
  formulas move as values or text per a stated rule).
- Block G, cp49-56: 49 hidden rows and columns; 50 SUBTOTAL (skips hidden rows, nested
  SUBTOTALs); 51 find and replace in inputs; 52 named constants; 53 sheet-scoped names over
  workbook names; 54 delete sheet (references become #REF!, names too); 55 workbook-wide undo
  across sheets; 56 save format v3 (formats, notes, validation, merges, hidden) and migration.
  Probe P4 after cp50 (blocks A-D details, git-files).
- Block H, cp57-64: 57 TEXT(value, format) reusing cp41; 58 EDATE, EOMONTH, WEEKDAY (stated
  conventions); 59 NETWORKDAYS with holidays; 60 CHOOSE and SWITCH; 61 SUBSTITUTE, FIND, SEARCH
  (stated wildcard rule); 62 LET (local names, shadowing rules); 63 a decimal-comma locale option
  for display and CSV; 64 fill down and fill right (relative moves as cp26, series rule).
- Block I, cp65-72: 65 change events (onChange, batched by setMany); 66 book.batch(fn) atomic
  with rollback on throw; 67 formula length and nesting limits (stated error); 68 copy across
  sheets (sheet-prefix rewrite); 69 CSV import options (delimiter, header row, types);
  70 diff of two saved workbooks; 71 protected cells (locked cells refuse set, undo unaffected);
  72 error audit (all error cells in a stated order). Probe P5 after cp65 (blocks A-G).
- Block J, cp73-80: 73 lint (unused names, references to empty cells); 74 performance budget 2
  (large fan-out recalc); 75 API v3 with deprecation log; 76 history labels and an undo-stack
  query; 77 range export to JSON with formats; 78 rename names (rewrite formulas); 79 cell styles
  copied with copy/fill; 80 final consistency: CHANGES.md through cp80 and a stated API index.

CM-250 pilot (cm250-sonnet-r1, cornerman 0.7.2): all 40 in 38 minutes, 3 sessions (2 clears at
about 258k), peak 258,437, work 582,518, US$8.30. Hidden 38/40 (fails cp21, cp30), 0 regressions,
0 rule violations, probes 30/30. n = 1 per arm: calibration only, not a comparison.

## Block F progress (2026-11-09)

- cp40 retune (first commit of the block): CHANGES.md may hold entries after the 40th, which must
  continue in order (`- cp41: `, `- cp42: `, ...) under the length, spacing and no-duplicate rules;
  the first 40 are checked exactly as before. The bare-title rule for cp41+ lines is checked by
  each later checkpoint's own hidden test (each cp41-48 hidden file has a "CHANGES.md has a cpNN
  line" test). Visible test relaxed the same way (`>= 40`). New cp40 mutant
  `changes-late-out-of-order` (cp41/cp42 swapped) killed. This changes frozen files: re-freeze.
- Shared infrastructure: layers.mjs (per-cell layers formats/notes/rules plus merges, moved by
  insert/delete through structure.mjs, in structural snapshots, undo entries `{ layer, ... }`),
  history groups (`{ group: [...] }`, one undo step for copy and sort), features.mjs (the new
  sheet methods), graph.mjs `parseEntry` (moved out of sheet.mjs to keep it at 295 lines).
- cp41 number formats (numfmt.mjs, layers.mjs, features.mjs): departures half-even rounding on the
  decimal form (1.005 -> 1.00, 0.125 -> 0.12), inserted rows/cols get no format, formulas never
  inherit a format (`=A1&""` is the plain text). `%` moves digits (0.575 -> 58%); copy copies
  formats; toCSV writes formatted text. 12 mutants.
- cp42 cell notes (features.mjs, persist.mjs, workbook.mjs): departures copy does not carry notes,
  text is trimmed and blank removes, an insert drops a note pushed off the sheet with no #FULL.
  v1 and v2 saves gain an optional `notes` object (omitted when empty, so earlier save texts are
  byte-identical), checked on load after names. 11 mutants (+1 cp40).
- cp43 COUNTIF and AVERAGEIF (criteria.mjs on the cp22 matcher): departures type-strict criteria
  and no wildcards, error cells never match (not even `<>`), averageRange must be the same shape.
  8 mutants.
- cp44 INDEX and MATCH (indexing.mjs): departures MATCH defaults to type 0, a lone INDEX index is
  always the row (INDEX(A1:C1, 2) is #REF!), types 1/-1 search the whole unsorted range and take
  the first of tied best values. 0 is #REF!, 2-D MATCH range is #VALUE!. 8 mutants.
- cp45 SUMPRODUCT (products.mjs): departures non-range arguments are #VALUE! and never evaluated
  (SUMPRODUCT(1/0) is #VALUE!, array arithmetic refused), booleans count 1/0. Same width and
  height, any error in any range wins by priority. 7 mutants.
- cp46 data validation (validation.mjs, layers.mjs check): departures list match is exact (case
  and spaces), formulas and clearing always pass, copy neither checks nor carries rules. set,
  setCell, setMany, fromCSV check every input before writing (#INVALID); undo/copy/structure do
  not; `invalidCells()`. 11 mutants.
- cp47 merged ranges (merges.mjs, layers.mjs, sheet.mjs valueOf/recalc/toCSV): departures covered
  cells keep hidden inputs (unmerge brings them back), copy ignores merges (copies hidden inputs,
  writes into covered cells). Covered cells read empty everywhere (cross-sheet too), are never
  evaluated or listed by recalc; set/setMany/fromCSV refuse them with #MERGE before validation;
  insert/delete resize like formula ranges and drop one-cell merges. 10 mutants.
- cp48 sorting a range (sort.mjs, features.mjs): departures formulas move as typed text (refs not
  shifted), notes and rules stay while inputs and formats move, descending keeps ties stable with
  errors and empties last. Writes unchecked; #MERGE when the range touches a merge. 10 mutants.
- Older mutants whose find text moved (same intent): copy-reads-own-writes, copy-step-per-cell,
  csv-formulas-evaluate, csv-in-skip-empty, csv-in-step-per-cell, save-evaluates. 300 mutants.
- Not saved yet (left for cp56): formats, validation rules, merges. The cp41/46/47 specs say so;
  no test asserts it, so cp56 can add them without breaking a hidden test.

## Block G progress (2026-11-10)

Written by the Block G agent; its final report was lost to a session clear, so this note was
assembled by the orchestrator from the commits and the agent's mutant log. Departures are stated
in each cpNN/spec.md.
- cp49 hidden rows and columns (hiding.mjs, namedefs.mjs, layers.mjs, structure.mjs, csv.mjs). 8 mutants.
- cp50 SUBTOTAL (subtotal.mjs, functions.mjs, engine.mjs). 9 mutants. Probe P4 (blocks A-D) after cp50.
- cp51 find and replace in inputs (findreplace.mjs). 10 mutants.
- cp52 named constants (names.mjs, namedefs.mjs, persist.mjs). 6 mutants.
- cp53 workbook names, sheet names win (booknames.mjs, bookio.mjs, workbook.mjs). 8 mutants.
- cp54 deleting a sheet, references and names become #REF! (refs.mjs, workbook.mjs). 8 mutants.
- cp55 undo across a workbook (history.mjs, workbook.mjs, booknames.mjs). 8 mutants.
- cp56 save format v3 with migration (save3.mjs, bookio.mjs). 10 mutants.
- Verified by the orchestrator 2026-11-10: check-tree cp01-56 green, mutants 367/367 killed,
  probe-selftest right 40/40 wrong 0/40 absent 0/40, SMOKE OK. cp50 spec: dropped a
  "checkpoint 3:" cross-reference (the agent's last edit).

## Block H progress (2026-11-10)

Fixture designer's calls, not yet reviewed by Macdara. Each spec states its departures with "This
is NOT what Excel does" / "...what you might expect".
- cp57 TEXT (text.mjs): departures: the format must be a checkpoint 41 format (anything else,
  `""` and `General` included, is #VALUE!), text is never read as a number (`TEXT("5","0.00")` is
  "5"), an empty cell is the number 0 (unlike the cp18 text functions). Format checked only after
  both arguments gave no error; result always text; cell formats play no part. 7 mutants.
- cp58 EDATE, EOMONTH, WEEKDAY (calendar.mjs; dates.mjs exports parts/daysIn/MAX): departures:
  months must be a whole number (Excel truncates), WEEKDAY defaults to type 2 (Monday = 1), a last
  day does not stay a last day under EDATE. Types 1/2/3 only, not truncated; results outside
  2000-9999 #VALUE!. 8 mutants.
- cp59 NETWORKDAYS (calendar.mjs): departures: end before start counts the same (never negative),
  text/booleans/empty in holidays are skipped, holidays must be a range argument and are not
  evaluated otherwise (as SUMPRODUCT). A `#REF!` holidays argument left by a delete is #REF!
  (found while writing the tests: it was #VALUE!). Counted by whole weeks, not day by day; no
  timing test. 9 mutants.
- cp60 CHOOSE and SWITCH (choose.mjs): departures: CHOOSE never gives a range
  (`SUM(CHOOSE(1, A1:A3))` is #VALUE!), SWITCH text matches with case; also stated: an error in a
  reached case is the result, an empty cell is 0, no match and no default #N/A. Both lazy with
  static dependencies, as IF. 9 mutants.
- cp61 SUBSTITUTE, FIND, SEARCH (search.mjs): departures: no match is #N/A (Excel #VALUE!),
  SEARCH has `?` and `*` but no `~` escape. SUBSTITUTE counts non-overlapping occurrences from the
  left; start must be 1 to LEN+1. 9 mutants.
- cp62 LET (let.mjs; graph.mjs collectRefs now walks LET scopes): departures: a LET name is a
  value, never a range (`LET(r, A1:A3, SUM(r))` and `LET(x, 5, SUM(x))` are #VALUE!, as cp52
  constants); where a LET name hides a defined name, that name's cells are not precedents and
  redefining it evaluates nothing again. Also stated: every value evaluated once in order, an error
  in a value matters only where the name is used, inside its own value a name means what it means
  outside. Structure errors #VALUE!; `abc12` is #PARSE! as before. 9 mutants.
- cp63 decimal comma (locale.mjs; sheet.mjs, engine.mjs, workbook.mjs, bookio.mjs): option
  `decimal: "."|","` on createSheet, loadSheet, createWorkbook and now loadWorkbook(text, options)
  (checked after errorOrder; loadWorkbook's error order still comes from the text). Departures:
  inputs, formulas and fromCSV are read as before (`"1,5"` is text), toCSV keeps `,` and quotes
  (Excel uses `;`), text values are shown as they are (`=A1&""` shows "0.5" beside "0,5"). Not
  saved; shared by a workbook's sheets, kept after remove/delete. 9 mutants.
- cp64 fill down and fill right (fill.mjs; copy.mjs `shiftFormula` split out of copyWrites):
  departures: two typed numbers start a series (Excel's fill down copies), text is never counted
  up (Excel's fill handle makes Item 2), a fill checks validation in row-major order (copy does
  not). Series values rounded half-even to 10 places and written as plain number text; formats
  follow each line's first cell; #MERGE when the target overlaps a merge. 9 mutants.
- Older mutants given new find text by the refactors, same intent: removed-sheet-still-bound,
  detached-loses-order, loadsheet-checks-text-first, migrate-skips-head-checks (cp63 options),
  copy-skips-empty (cp64 shiftFormula). The cp63 commit message says "Three" and lists four.
- functions.mjs: the cp58-cp62 tables join TABLE through one Object.assign line. sheet.mjs is
  295 lines; new sheet features should go in their own module (as fill.mjs, features.mjs).

## Block I progress (2026-11-10)

Fixture designer's calls, not yet reviewed by Macdara. Each spec states its departures with "This
is NOT what Excel does" / "...what you might expect".
- cp65 change events (events.mjs; sheet.mjs `write` and `rebuild` record each touched cell's input
  before the call; every public sheet and workbook method is wrapped as one call). Departures:
  events carry inputs only (a value changed through a formula, formats, notes and names never
  fire); a listener that throws is ignored and the call returns normally; an event caused by a
  listener is delivered after every listener has had the current one. Also: one event per call
  per sheet, row-major, cells changed back within the call left out, listeners fixed when the
  call ends. 9 mutants.
- cp66 `book.batch(fn)` (batch.mjs; core exposes `state`/`rebuild`, history.mjs `save`/`restore`).
  Departures: a batch is NOT one undo step; nested batches and the sheet-list methods throw
  `#BATCH`; only this workbook rolls back (createSheet sheets, other books and removed sheets keep
  fn's changes). Rollback restores every sheet's inputs, names and layers, every undo/redo list
  and the workbook names, and rethrows the same value; events wait for the end, none for a
  rolled-back sheet. 9 mutants.
- cp67 formula limits (limits.mjs, called from layers.check). Departures: 1,000 characters
  counting the `=` (Excel 8,192); grouping parentheses count toward the 16-deep nesting (Excel
  counts functions); limits apply only to typed inputs (set, setMany, fromCSV, fill, replace),
  while copy, sort, insert/delete, rename, undo and loading keep over-limit formulas. Strings are
  skipped, a stray `)` is ignored, unparseable text is checked too; per cell `#MERGE`, `#LIMIT`,
  `#INVALID`. 10 mutants.
- cp68 `book.copy(from, to)` (xcopy.mjs). Departures: unqualified references gain the source
  sheet's name (Excel's would read the target); references naming the target lose their prefix;
  on one sheet it is exactly `sheet.copy`. Formats copied, notes/rules/merges not, limits and
  rules unchecked, one undo step on the target. 10 mutants.
- cp69 `fromCSV(text, at, { delimiter, header, types })` (csv.mjs; fromCSV returns the header).
  Departures: the decimal comma never changes reading; `#CSV` record numbers count the header;
  `types: "text"` writes numbers and formulas as `="..."` text formulas, which therefore pass any
  validation rule (and the written text is what the limits check). Option errors after `at`,
  before the text. 10 mutants.
- cp70 `diffWorkbooks(before, after)` (diff.mjs, new index.mjs export). Departures: inputs are
  compared as typed; a renamed sheet is one removed plus one added (a case-only rename and a new
  sheet order are no difference); layers, errorOrder and version are not compared. `#LOAD` cells
  get a `before` / `after` prefix. 9 mutants.
- cp71 protected cells (protect.mjs; `locks` is a cell layer in layers.mjs; copy, sort and
  book.copy call `layers.locked`). Departures: only a change is refused (writing the same input is
  allowed); undo/redo are never checked and protect is not an undo step; insert/delete are allowed
  and move locks (Excel refuses). Per cell `#MERGE`, `#LOCKED`, `#LIMIT`, `#INVALID`; locks are not
  saved; undoing an insert or delete restores locks as they were before it. 11 mutants.
- cp72 `sheet.errorCells()` / `book.errorCells()` (audit.mjs). Departures: priority order with
  `#PARSE!` last, never reading order, also under errorOrder "first"; the book list orders by code
  across sheets before sheet order. `cell` is where the error began (unqualified across sheets).
  8 mutants.
- Probe P5 after cp65 (blocks A-G): #PARSE! -> cp02, SUBTOTAL codes 1,2,4,5,9, note limit 200,
  0.575 with 0% -> "58%", ROUND(2.5, 0) -> 2, #N/A -> cp21, SUMPRODUCT(1/0) -> #VALUE!,
  deleteSheet rewrite "=#REF!*2", git-files for cp47, invalidCells -> cp46. probe-selftest's
  scratch repo gains a cp47 commit.
- Older mutants given new find text, same intent: csv-in-skip-empty, csv-in-step-per-cell,
  fromcsv-unchecked, csv-in-edge-before-parse, csv-in-text-before-at (cp69 options), and
  merge-check-after-rule (went stale at the cp67 limit check; caught by a find-text check before
  the full run). cp69, cp70 and cp72 got a tenth hidden test after the first pass had nine.
- sheet.mjs is 296 lines: block J sheet features must go in their own modules (features.mjs now
  chains protect.mjs and audit.mjs).

## Block J progress (2026-11-10)

Fixture designer's calls, not yet reviewed by Macdara. Each spec states its departures with "This
is NOT what Excel does" / "...what you might expect".
- cp73 `sheet.lint()` (lint.mjs; sheet.mjs `core.peer`). Departures: only one-cell references
  count (cells inside ranges and behind defined names are never listed); every reference in the
  text counts, also in an untaken `IF` branch (nothing is evaluated); a name used only where a
  `LET` hides it is unused. Unused names first by name, then `empty-ref` by address and
  precedents() order; covered merge cells are empty; missing sheets and `#PARSE!` formulas skipped;
  `ref` labelled as precedents() labels it. 8 mutants.
- cp74 wide fan-out budgets (no new code). Departures: no early cut-off (a re-evaluated cell with
  the same value, or `1` to `1.0`, still re-evaluates every reader); a reference in an untaken
  `IF` branch is a dependent and is evaluated again. Budgets, each measured after every formula was
  read once: (1) 10,000 formulas `=$A$1+n`: set `A1` and reread all, 1 s, exactly 10,000
  evaluations; `dependents("A1")` (direct and transitive) 1 s each; (2) four layers of 60, each
  `=SUM(previous layer)+r`: set and read the last layer, 1 s, 240 evaluations; (3) 2,000 pairs of
  setting an unread cell and reading a fan-out cell, 1 s, 0 evaluations. Reference alone, 10 runs:
  (1) 27-52 ms, dependents 5-11 ms; (2) 32-82 ms; (3) 8-17 ms. The first budget started at 1.5 s
  and was cut to 1 s because the `invalidate-scans-edges` mutant took 1.77 s there (the
  `invalidate-per-path` mutant takes 2.7 s on budget 2). Only cp74's hidden file uses
  `performance.now`, so its 6 mutants run alone after the pool. 6 mutants.
- cp75 API v3 (api3.mjs: `cell`, `clear`, deprecation log; events.mjs keeps a frame stack of the
  public calls in progress). Departures: `clear` removes inputs only and skips covered cells (their
  hidden inputs come back on unmerge); a deprecated call that throws still counts; calls the
  library makes (v2 names, `cell`, `book.get`, ...) never count, while your calls in a listener or
  a batch do; the log is not undone, not saved, not rolled back. Deprecated: set, get, display,
  cells, getInput, book.sheet. sheet.mjs hands its `add*` chain to extend.mjs (291 lines now).
  11 mutants.
- cp76 `undoList`/`redoList` on sheets and books (undolist.mjs; history.mjs stamps `label` from
  events.mjs `callLabel()` and adds `steps(which)`). Departures: aliases keep their own labels
  (`set` vs `setCell`); a step inside `book.batch` is labelled with the inner call, never `batch`;
  the book lists are ordered by time across sheets, not sheet by sheet (`sheet: null` for workbook
  name steps). 8 mutants.
- cp77 `sheet.exportJSON(target, opts)` (export.mjs). Departures: the range is always two corners
  (`B2:B2`); hidden rows and columns are included (unlike toCSV); values are full JSON numbers,
  errors `{ error, cell }`, non-finite numbers `null`, typed `TRUE` the string. `display` and
  `formats` options; target checked before options. 9 mutants.
- cp78 `sheet.renameName` / `book.renameName` (rename.mjs: name tokens mapped to the AST's name
  nodes in source order, scoped as collectRefs). Departures: a case-only rename does nothing at all
  (unlike renameSheet); LET-hidden uses and LET names are not rewritten; `book.renameName` skips a
  sheet with its own name of that name; rewrites ignore locks and limits; the sheet rename is one
  undo step while the book rename clears every undo list. 8 mutants.
- cp79 cell styles (styles.mjs; `styles` joins CELL_LAYERS in layers.mjs; sheet.copy, fill.mjs and
  xcopy.mjs write styles beside formats, sheet.copy through `layers.carry`). A first version wrapped
  `sheet.copy` in an outer undo group, which hid `copy-step-per-cell` (cp27) in the full run; the
  styles write moved inside copy's own group. Departures: setStyle
  merges keys into the cell's style; sort leaves styles where they are; inserted lines have no
  style (Excel copies the row above). Copy pastes whole styles, also from empty cells; not saved
  (a styles-only book still saves v2). 9 mutants.
- cp80 `apiIndex()` (apiindex.mjs, new index.mjs export) with the stated lists: 6 exports, 69 sheet
  methods, 21 workbook methods. Departures: deprecated names stay in the index; a sheet or
  workbook object may have no other function-valued own property. CHANGES.md now holds exactly 80
  entries; the cp80 test also checks every cp41-cp80 text against its FEATURES.md title. 8 mutants
  (3 edit CHANGES.md).
- Older mutants given new find text by the refactors, same intent: `book-calls-unwrapped` (the
  workbook return line now starts with addDeprecations), `limit-checked-on-copy` (its import
  anchor moved to extend.mjs), `copy-skips-formats` and `lock-copied` (the copy line gained the
  styles write). 579 mutants; each also checked against its target alone before the full run.
- Verified before the full mutant run: check-tree cp01-80 all green (visible 134/134, hidden
  701/701), SMOKE OK, probe-selftest right 50/50 wrong 0/50 absent 0/50, every mutant's find text
  applies.
- Full mutant run (`--jobs 8`, after the cp79 fix): 579/579 killed, none survived, none did not apply.

## Pilot 2 result (80 checkpoints, Sonnet, one run per arm; calibration, not scored)

| | Default r2 | CM-250 r2 |
|:--|:--|:--|
| Checkpoints passed (hidden) | 73/80 | 75/80 |
| Late segment cp32-80 (K = 32) | 44/49 | 44/49 |
| Regressions on the final tree | 1 | 2 |
| Rule violations (after the eval fix) | 2 | 0 |
| Probes right | 49/50 | 42/50 |
| Work tokens / peak context | 1,752,815 / 959,403 | 1,357,258 / 260,144 |
| Sessions / compactions | 1 / 1 | 6 / 0 |
| API-equivalent cost | US$37.38 | US$20.01 |
| Wall time | 5 h 24 min (3 h 20 min of 5-hour-limit waits) | 1 h 33 min |

The longer task does what pilot 1 could not: Default filled the window to 959k and compacted
once. Late pass rates are equal at n = 1 and 44/49 is under the 95% ceiling rule, so the task
stays as frozen. Both runs together used up one 5-hour usage window (Default waited 10 times).

## Fix and retune (2026-11-12, no paid run)

- Step 1 (51e66df): 30 unwritten rules stated in 24 specs, fair probe key, house rules printed
  once by the gate, scorer and compare additions. Detail in the PREDICTIONS.md re-freeze note.
- Step 2: 26 late checkpoints gained one `cpNNh recall` hidden test (a new feature must obey a
  rule from cp01-31), 14 spec pointers, 26 `recall-*` mutants. A separate reviewer judged all 26
  fair (I:/Scratch/_q1m-audit/harden-review.md). The other 23 late checkpoints got none: existing
  tests already caught every candidate, or no fair early-rule assertion was found.
- Verified: check-tree cp01-80 hidden 727/727, mutants 605/605 killed (`--jobs 8`), probe-selftest
  5/5, SCORE SELFTEST OK, COMPARE SELFTEST OK, rule negatives 18/18, SMOKE OK.
- Calibration on default-sonnet-r2 with the new tests: late 42/49 (was 44/49). The two new
  failures (cp60, cp62) rest on a cp13 sentence added in step 1 that the pilot never saw. Fair
  hits: 0 of 23. With cp44, cp45 and cp77 now stated in the specs, a fresh Default run is
  estimated near 47/49 (96%), outside the 40-80% band.
- Outcome: hardening stopped (Macdara, 2026-11-12). The task does not discriminate on Default's
  late pass rate. Proposal for a "no worse and cheaper" primary: REFRAME-DRAFT.md (draft).
- 2026-11-12 16:40 AWST: Macdara rejected the reframe: "We should develop a test that is hard
  enough, and matches our testing requirements more suitably". See "Chat-only layer" below.

## Chat-only layer (design, 2026-11-12; not built, nothing frozen)

Rulings (Macdara, 2026-11-12, via cards): keep the spreadsheet task and its harness, gate, scorer
and mutants; add a layer of chat-only facts; use all four fact types below; an agent may keep its
own notes file but nothing prompts either arm to.

### Why the task sits at the ceiling (measured on the pilot 2 data)

- **The repo carries every rule.** The gate writes each checkpoint's visible tests into
  `test/visible/` and they stay there: by cp80 the agent's own suite re-checks cp01-80 on every
  run. Late specs restate or point at the early rules (the 30 sentences from step 1 made this
  more true). A late feature that breaks an early rule fails a test the agent can see.
- **Clearing does lose chat memory, and the code does not need it.** Probe P5 (asked during cp65):
  CM-250 3/10, Default 9/10. CM-250's wrong answers came from the model's Excel prior, not the
  spec: `ROUND(2.5, 0)` "3" (spec: 2), SUBTOTAL codes listed as Excel's 20 (spec: 1, 2, 4, 5, 9).
  Its code still passed, because the code and tests held the right answers.
- **Default resets too.** Default compacted once during cp58 (967,427 to 18,637 tokens). Its P5
  score after that came from reading the repo. Neither arm wrote a notes file in either pilot.

So the late tests have to depend on facts the repo cannot hold: stated once in chat, with nothing
to build or test when they are stated.

### Mechanics

- **Plant:** a fact stated once, in an early spec (cp02-cp28, all before K = 32), under a heading
  `## Coming later`. It concerns a feature that does not exist yet, so there is nothing to
  implement and no visible or hidden test at the plant checkpoint. It cannot reach the code.
- **Trigger:** the late checkpoint that builds the feature. Its spec does not restate the fact.
  One hidden test per trigger (`cpNNc chat: ...`) checks it, plus one `chat-*` mutant.
- **Placement:** triggers split across the two regimes seen in pilot 2: about half in cp35-58
  (Default still holds the whole chat, CM-250 has cleared) and half in cp59-80 (Default has
  compacted, so it depends on its compaction summary, and CM-250 on its handovers). This lets the
  result go either way. Placement is fixed before any run and does not move after one.
- **Probes never ask about a plant.** A probe answer would put the fact back into context.

### The four fact types

| Type | Plant says | Trigger spec says | Hidden test checks |
|:--|:--|:--|:--|
| Deferred requirement | "When X arrives, it must do Y." | Builds X, silent on Y | Y |
| Override of Excel | A stated choice that differs from Excel, for a feature with no code yet | Builds the feature, silent | The stated choice, not Excel's |
| Rejected approach | "We tried Z for X; it broke W; never do Z." | Builds X where Z is the natural route | W still holds |
| As agreed earlier | A format or wording agreed for later | "Use the format we agreed for X", no restatement | The agreed format |

### Fairness rules (each pair must pass all six; a separate reviewer checks them)

1. The plant is one unambiguous sentence and a hidden assertion can check it exactly.
2. Nothing at the plant checkpoint can implement or test it (the feature does not exist yet).
3. The plant's answer differs from the Excel default and from the most likely guess, so a model
   working from its prior fails. An agent that remembers it, or wrote it down, passes.
4. No later spec contradicts it or restates it (grep every spec after the plant).
5. It shares no code path with anything built earlier, so the repo cannot carry it.
6. The reference implementation obeys it, and its `chat-*` mutant is killed.

### Candidate pairs (DRAFT: each still needs the rule 4 and 5 check against the actual specs)

| # | Type | Plant | Trigger | Fact |
|:--|:--|:--|:--|:--|
| 1 | Override | cp19 dates | cp58 WEEKDAY | Default numbering is Monday = 1 (Excel: Sunday = 1) |
| 2 | Override | cp19 dates | cp59 NETWORKDAYS | The working week is Sunday to Thursday |
| 3 | Override | cp18 text | cp61 FIND/SEARCH | Not found returns 0, not `#VALUE!` |
| 4 | Override | cp21 VLOOKUP | cp44 MATCH | Default match type is exact (Excel: 1) |
| 5 | Override | cp22 SUMIF | cp43 AVERAGEIF | No matching cell gives 0, not `#DIV/0!` |
| 6 | Override | cp06 comparison | cp48 sort | Type order: errors, booleans, numbers, text, empty last |
| 7 | Deferred | cp15 aggregates | cp50 SUBTOTAL | Only codes 1, 2, 4, 5, 9 (removed from the cp50 spec) |
| 8 | Deferred | cp28 CSV export | cp77 JSON export | Dates export as `yyyy-mm-dd` text, not serials |
| 9 | Deferred | cp24 delete rows | cp54 delete sheet | Deleting the last sheet is refused with code `LAST_SHEET` |
| 10 | Deferred | cp14 named ranges | cp52 named constants | Constant names are upper case only |
| 11 | Deferred | cp10 precedents | cp39 explain | Never more than 3 levels deep; deeper shows `...` |
| 12 | Deferred | cp26 copy | cp68 copy across sheets | References to the source sheet stay explicit (`Data!A1`) |
| 13 | Deferred | cp23 insert rows | cp71 protected cells | Inserting rows inside a protected range is refused, not shifted |
| 14 | Deferred | cp30 save | cp70 compare saves | Formatting-only changes are ignored |
| 15 | Deferred | cp09 cycles | cp72 error audit | Each cycle listed once, named by its top-left cell |
| 16 | Deferred | cp12 recalc log | cp65 change events | Old value of an empty cell is `null`, not `""` |
| 17 | Rejected | cp11 incremental | cp74 fan-out budget | Never cache range results across recalcs (stale after insert) |
| 18 | Rejected | cp13 SUM syntax | cp62 LET | Never bind names by rewriting formula text (breaks string literals) |
| 19 | As agreed | cp27 undo | cp76 undo labels | Label = verb + target, lower case, e.g. `set A1` |
| 20 | As agreed | cp29 CSV import | cp69 import options | Semicolon delimiter when line 1 has more `;` than `,` |

Twenty pairs: 9 triggers in cp35-58, 11 in cp59-80. Several late specs already state some of
these facts (cp50 lists the SUBTOTAL codes); those sentences move to the plant.

### Step 1 result (2026-11-12, read-only check against the specs; supersedes the table above)

Of the 20 drafts, 4 survive with changes and 16 are dropped: 11 contradict the trigger spec as
written (for example cp61 already rules FIND's not-found as `#N/A`, cp39 needs a 9,999-deep tree),
and the rest are already stated, already carried by early code or tests, or have no feature to
hang on. Three citations were spot-checked by hand (cp58:42-43, cp61:38-39, cp62:22-24); all match.

**What works instead: move a sentence.** Every surviving pair takes one rule the trigger spec
already states, which a hidden test already checks and the reference already obeys, deletes it
from the trigger spec and states it once in an early plant. Build cost is mostly spec edits.

| # | Plant | Trigger | Fact moved to the plant | Delete from trigger |
|:--|:--|:--|:--|:--|
| 1 | cp19 | cp58 WEEKDAY | Default type 2: Monday 1, Sunday 7 | cp58:42-43 |
| 4 | cp21 | cp44 MATCH | Default match type 0 (weak on rule 3: VLOOKUP is exact-only, so 0 is guessable) | cp44:32-33 |
| 7 | cp15 | cp50 SUBTOTAL | The whole code table; cp50 says "codes as agreed" | cp50:3 "five", 7-21 |
| R5 | cp24 | cp51 replace | `replace` returns cells changed, not occurrences | cp51:38-39 |
| R6 | cp26 | cp48 sort | Sorted formulas move as typed text, references not adjusted | cp48:29-32 |
| R9 | cp28 | cp54 delete sheet | Deleting the only sheet is allowed (Excel refuses) | cp54:20-21 |
| R10 | cp28 | cp49 hidden rows | `toCSV` omits hidden rows and columns | cp49:25-30, and the clause at cp77:48 |
| R11 | cp18 | cp46 validation | List validation compares case-sensitively (repo helper is case-insensitive) | cp46:23-26 |
| 14 | cp28 | cp70 compare saves | Only inputs are compared ("nothing else") | cp70:37-40 |
| R2 | cp19 | cp59 NETWORKDAYS | Start after end gives a positive count | cp59:23-25 |
| R3 | cp18 | cp61 SEARCH | No escape character; `~` is ordinary | cp61:43-46 |
| R8 | cp28 | cp77 JSON export | `range` always has two corners (`B2:B2`) | cp77 `range` bullet |
| R12 | cp26 | cp68 cross-sheet copy | A reference naming the target sheet loses its sheet name | cp68:26-29 |
| R13 | cp27 | cp71 protected cells | Undo and redo never check protection | cp71:34-37 |
| R15 | cp21 | cp72 error audit | `errorCells` ordered by error priority, then row-major | cp72:33-34 + 2 bullets |
| R16 | cp27 | cp65 change events | A listener that throws is ignored; others still run | cp65:43-45 |
| R17 | cp28 | cp75 API v3 | `clear` removes inputs only; formats, notes, rules stay | cp75:17-18 |
| R18 | cp14 | cp62 LET | A name inside its own value means its outer meaning | cp62:22-24 |
| R19 | cp27 | cp76 undo labels | A step inside a batch is labelled with its method, never "batch" | cp76:27-28 |
| R20 | cp29 | cp69 import options | `types: "text"` stores number-like fields as `="007"` | cp69:40-45 detail |

Regime split: 8 triggers in cp35-58, 12 in cp59-80. Every line number is from the step 1 check;
re-read each before editing.

**Open for the build session (not yet decided):**
- **Type coverage.** All 20 are deferred requirements or overrides. "Rejected approach" lost both
  drafts (17: early tests already catch a stale cache; 18: the AST parser makes text rewriting
  unnatural). "As agreed" is only pair 7. Plan: phrase 3-4 trigger specs as "as agreed at cpNN"
  pointers (fair: a real user says that), and look for 2 rejected approaches where the wrong
  route is natural and no early test catches it. If none is fair, record that and go without.
- **Crowding.** cp27 carries 3 plants and cp28 five. Spread where a plant fits elsewhere.
- **Pair 4** stays only if the reviewer passes it on rule 3.
- cp80's API index must not gain any method a plant implies.

**Settled 2026-11-12 (build session, within the rulings above):**
- **Type coverage, all four types used.**
  - As agreed (4): pair 7 (cp50 "codes as agreed"), R19 (cp76), R20 (cp69), R8 (cp77). Each
    trigger says "as agreed when <feature> was built" with no checkpoint number and no hint of
    the answer; the plant says "when <later feature> arrives, we agree: ...".
  - Rejected approach (2): R6 and R13, re-typed, same fact and same hidden assertion.
    - R6 plant (cp26): moving sorted rows with the copy rule (references shift) was tried and
      broke formulas that point outside the sorted block; sorted formulas keep their typed text.
      The natural route at cp48 is to reuse copy, and Excel's prior also shifts, so rule 3 holds.
    - R13 plant (cp27): routing undo and redo through the protected write path was tried and left
      history half-applied; undo and redo never check protection. The natural route at cp71 is
      exactly that write path.
    - 17 and 18 stay dropped (reasons above).
  - Deferred or override (14): the rest.
- **Crowding.** cp28 keeps R10 and R8; 14 and R17 move to cp30 (save and load), R9 to cp31
  (workbooks). cp27 keeps R13 and R19; R16 moves to cp12 (recalculation log, the first event-like
  feature). Most plants per checkpoint is now 2. Rule 5 is re-checked at each new host.

**Review result (2026-11-12, separate Sonnet reviewer given specs, diff and tests only):** 6 of 20
dropped, 14 kept with fixes.
- Dropped:
  - R18 (cp62): sequential LET gives the plant's answer anyway, so rule 3 fails.
  - R6 (cp48): "the input of every cell goes to the row's new position" restates the fact, so
    rule 4 fails. Both rejected-approach pairs are now gone except R13.
  - R19 (cp76): per-call labels already give it; cp66:17 and cp76:20 state it.
  - 14 (cp70) and R17 (cp75): the trigger spec still says it (cp70:6-8, cp75:17, cp41:52).
  - R9 (cp54): `deleteSheet` is "exactly as with `removeSheet`", which has no guard. Rule 5 fails.
- The reviewer's call to drop R11 (cp46) is overruled. cp06:21 makes text equality
  case-insensitive, so an agent that reuses the engine's comparison for "one of the items" refuses
  nothing on case. Only the plant settles it.
- Kept: R13, after removing the method list at cp71 that hinted at the omission of undo.
- Fixes on the kept pairs: non-chat hidden tests no longer depend on a plant (pairs 1, 4, R15, R5,
  R10, R20), and hints in cp50, cp58, cp59 and cp77 are neutralised.
- Types after the review: as agreed 4 (7, R20, R8, R15; cp72 took the pointer), rejected
  approach 1 (R13), the rest deferred or override.
- P5.2 (asks for the SUBTOTAL codes) is asked after cp65, after the cp50 trigger, so it stays.

### Scoring change (to freeze with the build)

- Primary stays the late hidden-test pass rate cp32-80, so existing tests still count. Reported
  beside it: the chat-test pass rate (20 tests), per regime (cp35-58, cp59-80).
- The 40-80% rule applies as before, on a fresh Default pilot (the pilot 2 data never saw the
  plants, so it cannot calibrate this). Expected: Default high on the cp35-58 triggers, lower on
  cp59-80. That estimate is a guess until the pilot.

### Build steps (all US$0 until the pilot)

1. Check each candidate against the specs for fairness rules 4 and 5; drop or replace the failures.
2. Write the plants, strip any restatement from the trigger specs, write the hidden tests and the
   reference changes, add the `chat-*` mutants.
3. Separate reviewer given plants, trigger specs and tests only (not this reasoning) judges each
   pair against the six rules.
4. Verify: reference passes all hidden tests, all mutants killed, self-tests and gate smoke OK.
5. Re-freeze with a dated PREDICTIONS.md note (it must also correct the 08:40 AWST note that says
   the reframe was chosen).
6. Default-only calibration pilot on Sonnet: about US$37 API-equivalent (pilot 2's Default run),
   needs Macdara's yes first.

## Pilot 3 (chat layer, Default only; 2026-11-12, calibration, not scored)

Run `default-sonnet-r3`, frozen tree 135920c, claude-code 2.1.316, Sonnet, window 1,000,000.
Moved to I:/Scratch/_q1m-pilot/ after scoring.

| | Default r3 | Default r2 (for reference) |
|:--|:--|:--|
| Checkpoints passed (hidden) | 75/80 | 73/80 |
| Late segment cp32-80 | 45/49 (92%) | 44/49 |
| Chat tests | 12/14 (cp35-58 5/6, cp59-80 7/8) | not built |
| Regressions on the final tree | 0 | 1 |
| Rule violations | 4 (1 distinct; cp27, 28, 64, 78) | 2 |
| Probes right | 49/50 | 49/50 |
| Work tokens / peak context | 866,711 / 866,711 | 1,752,815 / 959,403 |
| Sessions / compactions | 1 / 0 | 1 / 1 |
| API-equivalent cost | US$23.86 (run 23.74 + smoke 0.12) | US$37.38 |
| Wall time | 1 h 19 min, 0 limit waits | 5 h 24 min |

Late failures: cp52 (12/13), cp54 (8/9), cp58 (10/11, chat test), cp68 (12/13, chat test).
The scorer printed `late -` because K is set by the first compaction and there was none; the
45/49 above is cp32-80 counted from `score.json` rows.

Result against the 40-80% rule: **outside, above** (92%). The chat layer did not move Default:
12 of 14 chat facts were recalled with the whole run in one uncompacted context. Second finding,
more basic: Default never filled the window (peak 867k of 1M, no compaction), so this run never
reached the condition the test is meant to compare (clearing vs a full, compacted window).
Pilot 2 compacted once only because it used twice the work tokens on the same task.

Per the handover rule: reported and stopped. No further recall-hardening proposed; no paid run
without a fresh yes.

## Pilot 4 design: forced fill (2026-11-12 night)

Ruling (Macdara, card, ~21:55 AWST): make Default fill and compact before the first trigger, then
one Default-only Sonnet pilot (about US$30-40). Above the band again = stop, write up the null.

- Mechanism: `harness/noise.mjs` makes one seeded build-log block per checkpoint (package-mirror
  sync lines: timestamps, unrelated npm package names, sizes, short hashes; no spreadsheet words,
  no error codes, no rules). The gate puts it ahead of the spec on every reveal, never on refusals
  or probe stops, and logs a `fill` event. Same block for every arm.
- Inline delivery: Claude Code 2.1.316 shows at most `bashOutputMaxChars` characters of Bash
  output inline (default 30,000) and saves the rest to a file. Every arm's settings now set
  100,000. The arm smoke runs the cp12 block through the Bash tool and passes only if the model
  quotes its last line.
- Size: measured by the smoke, 56,000 chars = 34,799 tokens; set to 25,700 chars = 16,074 tokens.
- Sizing (cumulative context at reveal, from the two Default curves): plants end at cp29; pilot 3
  sat at about 375k by cp36 and pilot 2 at about 417k by cp33. Adding 16k a checkpoint puts both
  at about 950k (pilot 2's compaction point) between cp32 and cp36, inside the cp30-43 target.
  After the first compaction the context regrows at roughly 26-30k a checkpoint, so a second
  compaction is expected in the cp60s.
- Pass for this design: the pilot's first compaction lands in cp30-43. If it lands elsewhere, the
  fill did not do its job and the late rate is not read against the band.

## Pilot 4 result: the fill was filtered out (2026-11-13, stopped at cp34)

Run `default-sonnet-r4`, frozen tree bca3500. It reached cp34, then hit the 5-hour usage limit
and the harness process ended during a wait (2026-11-13 00:21 AWST). Not resumed.

- The fill never landed. The first block reached the model whole (cp01 gate reply 28,140 chars).
  From cp02 on, Default ran `node gate.mjs next | grep -v '^20[0-9][0-9]-'`, which strips every
  log line; gate replies were 1-2k chars for the rest of the run. Peak context by cp34: 410,342,
  in line with pilot 3's unfilled curve. No compaction.
- So the design fails its own pass rule (first compaction in cp30-43) and the late rate cannot be
  read against the band. Cost: US$7.38 API-equivalent.
- What it shows: a competent agent removes predictable tool noise from its own context in one
  step. A fill that survives this has to be content the agent needs to read, which changes the
  task, not the window. The header line saying the log does not concern the task made the filter
  easier, but the timestamp prefix alone was enough.

## Fill dial (design, 2026-11-13; not built, nothing frozen, US$0 so far)

Ruling (Macdara, card, 2026-11-13 ~07:50 AWST): design a fill dial first, US$0, then a costed plan.

Why: four pilots show Default does not fill its window on this task (peaks 867k, 959k) and strips
padding it can see as noise (pilot 4). Waiting for the agent to fill cannot answer "does a full
window hurt?". The dial sets the fill directly, from one shared starting state, so every arm
starts from the same real session and differs only in what happens to its context at cp44.

### Fork point (checked)

- Claude Code 2.1.316 has `--resume <id> --resume-session-at <message id> --fork-session`.
- Pilot 3 session 9f17f65f, line 2694, `msg_011Cgy5CiyhMKuLH8UdtZW6i`: the agent commits cp43
  ("cp43: COUNTIF and AVERAGEIF", 55ac83d) and calls `node gate.mjs next` in the same message.
  Resuming at that message leaves the gate call unanswered, so the fork requests cp44 itself.
- Context there: about 456k (pilot 3 `workAtRequest` at cp44 = 456,301). All 14 plants (cp12-29)
  and all 5 probes before cp44 are inside it. Triggers left: all 14 (cp44-77). Late checkpoints
  left: cp44-80 (37).
- Paths: pilot 3's transcript holds absolute paths under I:/Scratch/_q1m/default-sonnet-r3/. Each
  fork runs at exactly that path (runs are one at a time under the lock), then moves out.

### Fork setup (to build)

1. Clone pilot 3's repo, reset to 55ac83d (cp43 committed, cp44 not revealed).
2. Gate state rebuilt from pilot 3's gate log up to cp43: `current` 43, visible hashes, probes
   answered. The gate then reveals cp44 on the fork's first `next`.
3. Copy the transcript into the fork's config `projects/` folder under the same session id.
4. Run `claude -p --resume 9f17f65f --resume-session-at msg_011Cgy5CiyhMKuLH8UdtZW6i
   --fork-session` with the arm's continue prompt, then score cp44-80 as now.

### Arms (all from the same fork)

| Arm | What happens at cp44 | Question it answers |
|:--|:--|:--|
| natural | nothing (about 456k) | baseline; also the validity check below |
| fill-700 | top-up to about 700k, then continue | does a fuller window cost quality? |
| fill-900 | top-up to about 900k; auto-compact follows within a few checkpoints | full window plus Default's own compaction |
| compact | `/compact` once, then continue | Claude's compaction at a chosen time |
| clear | cornerman handover, then a fresh session | cornerman's clearing |

Scoring: cp44-80 hidden pass rate (37) and chat tests (14), per arm. compare.mjs gains a fork
mode with K = 44.

### Top-up content (open: needs Macdara's pick)

The top-up goes in as one user turn before the agent's continue prompt, so it cannot be grepped
away. It must be real content, not noise.

- Own history: `git log -p` of the fork repo to cp43 is 374,443 chars, about 110k tokens. Task
  relevant, honest, enough for fill-700 (+245k) only with a second source.
- Second source, options: (a) an earlier unrelated task in the same session (a real public
  codebase the agent was "shown earlier"), the usual way real sessions fill; (b) the cp01-43
  specs and visible tests again, which duplicates what is already in context.
  Recommendation: (a). It models how real 1M sessions fill (several jobs in one window).

### Validity check (before any comparison)

A fork is not the same as a session that grew there. Check: the natural arm's cp44-80 result
against pilot 3's own cp44-80 (33/37 hidden, chat 12/14; all chat triggers sit in cp44-77; failures in pilot 3:
cp52, 54, 58, 68). Within 3 checkpoints at n = 1 = the fork method holds. Worse = stop.

### Cost estimate (API-equivalent, Sonnet)

- Pilot 3 cost US$23.74 for 80 checkpoints; cp44-80 runs on the larger half of the context, so a
  natural fork is estimated at about US$15. fill-900 about US$18, fill-700 about US$17, compact
  about US$10, clear about US$8.
- Dial pilot (validity + one filled arm): natural + fill-900, n = 1, about US$33.
- Full dial: 5 arms x n = 5, about US$340.

Rulings (Macdara, cards, 2026-11-13 ~08:00 AWST): top-up = own git history plus an unrelated
earlier task (a real public codebase presented as a previous job in the same session). Build the
fork setup and run the dial pilot: natural + fill-900, n = 1 each, Sonnet, about US$33
API-equivalent, approved. The full dial (about US$340) is not approved; it needs the validity
check to pass and a fresh yes.

### Fork build (2026-11-13, US$0)

`harness/fork.mjs` (setup, verify, run, park, score). Built and verified on
`fork-natural-sonnet-r1`: 13/13 static checks pass (repo HEAD 55ac83d, only `test/visible/`
untracked, 43 visible hashes match pilot 3's, visible tests pass on the fork tree, gate at cp43,
snapshots cp01-42, transcript holds the fork message at line 2695). No model call.

- Correction to "Fork point": 3 probes come before cp44 (P1 after cp15, P2 cp25, P3 cp35), not 5.
  P4 (cp50) and P5 (cp65) are still ahead of every fork.
- Config floor is pilot 3's own files (settings.json has no `bashOutputMaxChars`), not today's
  `arm.mjs setup`, so the fork continues under the config it grew in.
- Gate log is pilot 3's up to the cp43 reveal (92 lines); the cp43 done snapshot is made by the
  fork's own first `next`.
- `park` moves the parent transcript out of `projects/` before scoring: it runs on past cp44
  (pilot 3's own cp44-80) and would otherwise count as the fork's work.
- Top-up sizing: 2.4 chars a token, measured on pilot 3's tool results over 4,000 chars (141,382
  chars = 63,070 tokens). The "about 110k tokens" for the git history above used 3.4 and is
  likely low (about 156k at 2.4). Base context at the fork message: 457,180. The run checks the
  top-up turn's real context and stops (INVALID) if it is more than 40k from the target.
- Top-up source (fixed for every fill arm): undici 6.28.1 from npm, tarball sha256
  e18191aac9c0ff43dac7fe9b10b7041a22d07addb7b66a6e8ac14a52a5b69b74, `index.js` + `lib/**/*.js`
  in path order, the two `*-wasm.js` blobs left out; no spreadsheet or formula words. Framed as a
  side job (five lines on how `request()` reaches a socket), no tools, then the repo's
  `git log -p`.
- `compare.mjs --fork`: K fixed at 44, base = natural.
- Validity baseline re-checked from pilot 3's score.json: cp44-80 33/37, failures cp52, 54, 58,
  68; chat 12/14.

### Dial pilot attempts (2026-11-13)

- `fork-natural-sonnet-r1`: INVALID, US$0. `--resume-session-at` was given the API message id;
  it takes the transcript entry uuid (21df1607-cafb-4752-84ca-93fd876f2e2f). No model call.
- `fork-natural-sonnet-r2`: INVALID, about US$20.9 real. The fork worked (first call 457,685
  tokens, cp44 requested by the fork itself). The 5-hour usage limit hit at cp48 (02:05 UTC,
  10:05 AWST). The limited result carried all-zero usage, `run()` read that as "fork did not take"
  and forked pilot 3 again at cp43 while the repo and gate sat at cp48. Segment 6 then did
  cp48-80 without the cp44-47 conversation. Not scored.
  - Harness fixed after: context keeps the last non-zero value; re-fork only if the gate has not
    moved; a limit after the fork means wait and resume the forked session. Each forked
    segment's `total_cost_usd` included pilot 3's US$23.74 (the run log said US$163.36); that is
    now taken off. `park` moves the folder before the transcript.
  - Cost per natural fork, measured: about US$21 (US$3.6 for cp44-48, US$17.3 for cp48-80), above
    the US$15 estimate.

### Dial pilot result (2026-11-13, n = 1 per arm, exploratory)

| | natural (r3) | fill900 (r1) | pilot 3 (reference) |
|:--|--:|--:|--:|
| cp44-80 hidden | 31/37 | 28/37 | 33/37 |
| Chat tests | 12/14 | 9/14 | 12/14 |
| Compactions | 0 | 1 (cp48) | 0 |
| Peak context | 846,951 | 963,720 | 866,711 |
| Regressions | 1 (cp40) | 1 (cp40) | 0 |
| Real cost | US$14.96 | US$25.80 | - |

- Validity: natural lands 2 checkpoints from pilot 3 (limit 3): the fork method holds.
- fill900 vs natural: -8.1 points (95% interval -18.9 to +2.7), "no large effect at n = 1".
  The frozen prediction (fill900 within 3 checkpoints of natural) holds at its edge (3).
- Where they differ: fill900 also fails cp49, 59, 65 and 78; natural also fails cp50. Three of
  fill900's four extra failures are chat tests (cp49, 59, 65): facts said once in chat before
  cp30, lost after the cp48 compaction. Shared failures: cp52, 54, 58, 68, 80.
- Top-up landed at 905,572 (target 900,000). Auto-compaction came at cp48, five checkpoints in.
- Harness notes: three usage-limit waits at cp46 (same session resumed, as fixed); segments 5-7
  ended on transient `403 Cloudflare` auth errors and were resumed in the same session (no
  context lost). The run log's "cost 126.39" sums cumulative segment totals; the real cost is
  the last segment's US$25.80. Work tokens 3,907,400 (natural 846,951) are not yet explained
  and need a look before the full dial.
- Pilot spend in all: about US$61.7 (r2 invalid 20.9, natural 14.96, fill900 25.80), inside the
  US$67 approved.
