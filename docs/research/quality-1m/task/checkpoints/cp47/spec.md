# Checkpoint 47: merged ranges

A rectangle of cells can now be merged into one. The top-left cell of a merge shows its value as
before; the other cells of the merge are "covered": they read as empty.

## API

- `sheet.merge(target)`: merges the range `target` (two addresses joined by `:`, corners in any
  order, as for `setFormat` in checkpoint 41). Returns `undefined`.
- `sheet.unmerge(address)`: removes the merge that holds the cell `address` (any of its cells).
  Returns `true`, or `false` when no merge holds that cell.
- `sheet.merges()`: every merge as `"A1:B2"` text (top-left first, upper case), in row-major order
  of their top-left cells. `[]` when there are none.

## Covered cells

- A covered cell keeps its input: `getInput` still gives it, `cells()` still lists it, and
  `unmerge` brings its value back. Merging deletes nothing. This is NOT what Excel does (Excel keeps
  only the top-left cell's data when it merges).
- While it is covered, the cell reads as empty everywhere: `get` gives `null`, `display` gives
  `""`, and every formula that reads it (directly, in a range, by a name, or from another sheet of
  the workbook) sees an empty cell. `SUM(A1:C2)` over a merge `A1:B2` adds only `A1`, `C1` and
  `C2`.
- A formula in a covered cell is not evaluated while it is covered, so it adds nothing to
  `stats().evaluations`, and `recalc()` (checkpoint 12) never lists it.
- `toCSV()` writes `""` for a covered cell, and so does `toCSV({ formulas: true })`.
- Precedents, dependents and cycles still come from formula text (checkpoints 9 and 10): a formula
  that reads a covered cell still has it as a precedent.

## Writing to covered cells

- `set`, `setCell`, `setMany` and `fromCSV` refuse to write a covered cell: they throw `#MERGE`
  with `cell` = that address in upper case, and write nothing. They check every input before
  writing any, in the order checkpoint 46 states, and for each input the merge check comes before
  the validation check.
- `copy` (checkpoint 26) does not look at merges at all: it copies the hidden inputs of covered
  source cells, and it writes into covered target cells without refusing (their new inputs stay
  hidden). Merges themselves are never copied. This is NOT what you might expect.
- Undo and redo are never refused.

## Merges and other changes

- Undo (checkpoint 27): each `merge`, and each `unmerge` that returns `true`, is one undo step.
- Insert and delete (checkpoints 23-25) move and resize a merge exactly as they move and resize a
  range in a formula: rows or columns inserted strictly inside a merge make it larger, inserted at
  or before its first row or column move it, deleted ones make it smaller. A merge whose cells are
  all deleted is gone, and so is a merge that is left with a single cell. Undo puts merges back.
- Merges are per sheet. `book.renameSheet` does not change them. `save()` and `book.save()` do not
  write merges in this checkpoint.

## Errors

`merge` checks, in this order, and throws at the first failure, changing nothing:

| Check | `code` | `cell` |
| --- | --- | --- |
| `target` is an address or a range | `#ADDR` | `String(target)` |
| `target` holds at most 10,000 cells | `#ARG` | `target` |
| `target` holds at least two cells | `#MERGE` | `target` |
| `target` shares no cell with an existing merge | `#MERGE` | `target` |

`unmerge` throws for an invalid address as `get` does.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
