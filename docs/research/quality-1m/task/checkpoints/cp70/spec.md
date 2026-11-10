# Checkpoint 70: comparing two saves

## API

- `diffWorkbooks(before, after)`, a new export of `src/index.mjs` beside `loadWorkbook`: `before`
  and `after` are save texts, each anything `loadWorkbook` accepts (a version 2 or 3 workbook save,
  checkpoints 35 and 56, or a version 1 sheet save, which becomes one sheet named `Sheet_1`). It
  returns an array of changes, `[]` when nothing below differs. It changes nothing and evaluates no
  formula.

## The changes, in this order

1. `{ kind: "sheet-removed", sheet }` for each sheet of `before`, in its order, that `after` has no
   sheet of the same name (names compared ignoring case). `sheet` is its name as in `before`.
2. `{ kind: "sheet-added", sheet }` for each sheet of `after`, in its order, that `before` has no
   sheet of that name.
3. For each sheet of `after`, in its order, that `before` has too (`sheet` = its name as in
   `after`):
   - `{ kind: "cell", sheet, cell, before, after }` for each cell whose input differs, row-major:
     `before` and `after` are the inputs as `getInput` gives them, `null` for an empty cell.
   - then `{ kind: "name", sheet, name, before, after }` for each of that sheet's defined names
     (checkpoints 14 and 52) whose target differs, sorted by name: `before` and `after` are as
     `names()` writes them, `null` when the sheet has no such name.
4. `{ kind: "name", sheet: null, name, before, after }` for each workbook name (checkpoint 53) that
   differs, sorted by name, written as `book.names()` writes them.

## What counts as a difference

- Inputs are compared exactly as typed. `=a1` and `=A1` differ, and so do `2` and `=1+1`, or `5`
  and `5.0`, even though their values are the same. This is NOT what you might expect.
- Sheets are matched by name only. A sheet that was renamed is one `sheet-removed` and one
  `sheet-added`, and the cells of a removed or added sheet are not listed one by one. A change in
  the case of a sheet's name alone, and a change in the order of the sheets, are no difference at
  all. This is NOT what you might expect.
- Nothing else is compared: not number formats, notes, validation rules, merges, hidden rows and
  columns, the error order or the save version. A version 2 and a version 3 save of the same
  inputs and names give `[]`.

## Errors

`before` is loaded first, then `after`, as `loadWorkbook` loads them. When one fails with `#LOAD`
(checkpoint 30), `diffWorkbooks` throws `#LOAD` with `cell` = `"before"` or `"after"`, then, when
the `loadWorkbook` error's `cell` is not `""`, a `.` and that cell: `"after.sheets.0.name"`,
`"before.a1"` (a bad cell key `a1` in a version 1 sheet save), and `"after"` for text that is not
JSON.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
