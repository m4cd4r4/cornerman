# Checkpoint 48: sorting a range

A sheet can now reorder the rows of a range by the values in one of its columns.

## API

- `sheet.sort(target, column)` or `sheet.sort(target, column, opts)`: sorts the rows of the range
  `target` (an address or a range, as for `setFormat` in checkpoint 41) by the cells of `column`
  inside it. `column` is a column's letters (`"B"`, case-insensitive). `opts` is left out, or a
  plain object (not `null`, not an array) whose `descending` key is left out or a boolean.
  Returns `undefined`.

## The order

- The key of each row is the value its `column` cell has before the sort (what `get` gives then).
- Ascending order: numbers (smallest first, equal within the checkpoint 8 tolerance), then text
  (A to Z, ignoring case), then booleans (`FALSE` before `TRUE`), then errors, then empty cells.
- Descending order: booleans (`TRUE` first), then text (Z to A), then numbers (largest first), then
  errors, then empty cells. Errors and empty cells stay last.
- The sort is stable in both directions: rows whose keys are equal (all errors are equal, and all
  empty cells) keep the order they had. So descending is not ascending reversed. This is NOT what
  you might expect.

## What moves

- Only the cells inside `target` move, as whole rows of the range: the input of every cell of a
  row, in every column of the range, goes to the row's new position. Cells outside the range are
  untouched, and so are formulas elsewhere that point into it.
- A formula moves as its text, exactly as typed. Its references are not adjusted, so a formula
  `=A2*10` that moves from row 2 to row 5 still reads `A2`. This is NOT what Excel does (Excel
  shifts a moved formula's relative references by the rows it moved).
- Number formats (checkpoint 41) move with their cells. Notes (checkpoint 42) and validation rules
  (checkpoint 46) stay where they are, on the cell's place. This is NOT what you might expect.
- Moved inputs are not checked against validation rules (checkpoint 46), so `invalidCells()` may
  list cells afterwards.

## Other rules

- A sort is one undo step (inputs and formats together). A sort that changes nothing (the rows are
  already in order) is not recorded.
- A one-row range, or a range whose rows are all equal, changes nothing.
- After the sort, every value is what it would be if the moved inputs had been typed there.

## Errors

`sort` checks, in this order, and throws at the first failure, changing nothing:

| Check | `code` | `cell` |
| --- | --- | --- |
| `target` is an address or a range | `#ADDR` | `String(target)` |
| `target` holds at most 10,000 cells | `#ARG` | `target` |
| `column` is a string of one or two letters naming a column inside `target` | `#ARG` | `String(column)` |
| `opts` is as above | `#ARG` | `"opts"` |
| `target` shares no cell with a merge (checkpoint 47) | `#MERGE` | `target` |

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
