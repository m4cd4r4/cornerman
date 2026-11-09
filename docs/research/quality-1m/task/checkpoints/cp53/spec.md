# Checkpoint 53: workbook names

A workbook (checkpoint 31) can now hold names of its own, which every sheet in it can use. A
sheet's own names (checkpoints 14 and 52) still come first.

## API

- `book.defineName(name, ref)`: defines a workbook name for cells on a named sheet. `ref` is
  `Sheet!A1` or `Sheet!A1:B3`: a sheet name, `!`, then a cell or range written as for
  `sheet.defineName`. Returns `undefined`.
- `book.defineConstant(name, value)`: defines a workbook name for a constant, as
  `sheet.defineConstant` does (checkpoint 52). Returns `undefined`.
- `book.removeName(name)`: removes a workbook name. Returns `true`, or `false` when the book has
  no such name.
- `book.names()`: a plain object, name (upper case) -> target, sorted by name. A cell target is
  written with its sheet name as it was typed in `ref`, then `!`, then the cells as
  `sheet.names()` writes them: `book.defineName("total", "data!b3:a1")` gives
  `{ TOTAL: "data!A1:B3" }`. A constant is written as checkpoint 52 writes it.

## The target

- The sheet part follows the sheet-name rule (checkpoint 31). The sheet does not have to exist:
  until a sheet of that name (matched ignoring case) is in the book, the name reads as a
  reference to a missing sheet, `#REF!` (`cell` = the formula cell), in a value or a range
  argument. When such a sheet is added, removed or renamed, formulas using the name follow.
- `ref` must name a sheet. `"A1:B3"` on its own is `#ADDR`. This is NOT what Excel does (Excel
  reads it on the active sheet).
- A workbook name is never moved by row and column operations. After `Data.insertRows(1)`,
  `Data!A1` in a workbook name still means `Data!A1`, the new empty row, exactly as a formula
  reference with a sheet name is not rewritten (checkpoint 31). This is NOT what Excel does.
- `book.renameSheet` (checkpoint 37) rewrites the sheet part of every workbook name that names the
  old sheet (ignoring case) to the new name as typed.

## In formulas

- A name in a formula on a sheet of the book is looked up first among that sheet's own names. Only
  when the sheet has no name of that name is the workbook name used. Otherwise it is `#NAME?` as
  before. This holds in values and in function arguments alike.
- A workbook name for cells acts like a reference to those cells with the sheet name: a one-cell
  target as a cell, a range target as a range (`#VALUE!` outside a function argument, checkpoint
  14). A workbook constant acts as a sheet's constant does.
- The cells of a workbook name are precedents of the formulas that use it, labelled `Name!A1` as in
  checkpoint 32 (or plain on their own sheet).
- Defining, redefining or removing a workbook name, or defining or removing a sheet's own name of
  the same name, makes the formulas that use it give their new values.
- A sheet removed from the book (checkpoint 31), and a sheet made with `createSheet` or `loadSheet`,
  sees no workbook names.

## Undo and saving

- Workbook name changes are not recorded on any sheet's undo list and do not clear any.
- `book.save()` (checkpoint 35) writes a `names` object after `sheets` when the book has at least
  one workbook name: exactly what `book.names()` gives. A book with none writes no `names` key, so
  its save text is exactly what it was before this checkpoint.
- `loadWorkbook` reads `names` when it is there, after every sheet has been checked, and throws
  `#LOAD` at the first failure: `names` is not a plain object (`cell` = `"names"`), or a key is not a
  valid name written in upper case, or its target is not written exactly as `book.names()` would
  write it (`cell` = `"names.KEY"`). A version 1 sheet save migrated by `loadWorkbook` has no
  workbook names; its `names` are its sheet's own, as before.

## Errors

`book.defineName` and `book.defineConstant` check, in this order, and throw at the first failure,
changing nothing:

| Check | `code` | `cell` |
| --- | --- | --- |
| `name` is a valid name (checkpoint 14) | `#BADNAME` | `String(name)` |
| `defineName`: `ref` is a valid sheet name, `!`, and a valid cell or range of at most 10,000 cells | `#ADDR` | `String(ref)` |
| `defineConstant`: `value` is a finite number, a string or a boolean | `#ARG` | `String(value)` |

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
