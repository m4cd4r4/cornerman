# Checkpoint 49: hidden rows and columns

Rows and columns can now be hidden. Hiding never changes an input or a value, and from the next
checkpoint it changes what one function adds up.

## API

- `sheet.hideRows(at, count = 1)`: hides rows `at` to `at + count - 1`. Returns `undefined`.
- `sheet.showRows(at, count = 1)`: shows them again. Returns `undefined`.
- `sheet.hideCols(at, count = 1)` and `sheet.showCols(at, count = 1)`: the same for columns, with
  `at` given as column letters (`"C"`, case-insensitive), as for `insertCols` (checkpoint 25).
- `sheet.hiddenRows()`: the hidden row numbers, smallest first. `[]` when none are hidden.
- `sheet.hiddenCols()`: the hidden columns as upper-case letters, in column order (`"B"` before
  `"AA"`). `[]` when none are hidden.

`at` and `count` are checked exactly as `insertRows` and `insertCols` check them (checkpoints 23 and
25): an invalid one throws `#ARG` with `cell` = `String(at)` and changes nothing. Hiding a row that
is already hidden, or showing one that is not, is allowed and does nothing to that row.

## What hiding changes

- Hidden belongs to the row or column number, not to the cells in it. A hidden row may be empty.
- `get`, `display`, `getInput`, `cells()`, every formula, `precedents`, `dependents`, `recalc` and
  `fromCSV` (checkpoint 29) behave exactly as if nothing were hidden.

## Hidden rows and other changes

- Undo (checkpoint 27): each `hideRows`, `showRows`, `hideCols` or `showCols` call that hides or
  shows at least one row or column is one undo step. A call that changes nothing records nothing.
- Insert and delete (checkpoints 23-25) move a hidden row or column with the rows or columns around
  it: hidden row 4 is hidden row 6 after `insertRows(2, 2)`. A hidden row or column that is deleted
  is gone, and one that an insert pushes past the last row or column is dropped without an error.
  Rows and columns that an insert adds are never hidden, even when they land between two hidden
  ones. This is NOT what you might expect. Row operations never change hidden columns, and column
  operations never change hidden rows. Undo and redo of an insert or delete put hidden rows and
  columns back.
- `copy` (checkpoint 26) copies the cells of hidden rows and columns like any others, and never
  hides or shows anything.
- `sort` (checkpoint 48) moves inputs through hidden rows like any others; which rows are hidden
  does not change. So after a sort, a hidden row may hold different cells.
- Merges (checkpoint 47) and hidden rows do not affect each other.
- Hidden rows and columns are per sheet. `book.renameSheet` does not change them. `save()` and
  `book.save()` do not write them in this checkpoint.

`hiddenRows` and `hiddenCols` change nothing and are not recorded for undo.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
