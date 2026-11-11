# Checkpoint 78: renaming names

A defined name can now be renamed. Its target stays, and every formula that uses it is rewritten
to the new name, as `book.renameSheet` rewrites sheet names (checkpoint 37).

## API

- `sheet.renameName(oldName, newName)`: renames one of the sheet's own names (checkpoint 14, or a
  constant, checkpoint 52) and rewrites the formulas on that sheet that use it.
- `book.renameName(oldName, newName)`: renames a workbook name (checkpoint 53) and rewrites the
  formulas on every sheet of the workbook that use it.

Both return the number of cell inputs rewritten.

## Checks

Checked in this order; the first failure throws and changes nothing:

| Check | `code` | `cell` |
| --- | --- | --- |
| `oldName` is a string naming (ignoring case) one of the sheet's own names, or one of the workbook's names for `book.renameName` | `#BADNAME` | `String(oldName)` |
| `newName` is a valid name (checkpoint 14) | `#BADNAME` | `String(newName)` |
| `newName` is not, ignoring case, another name already there (the sheet's own names, or the workbook's) | `#BADNAME` | `String(newName)` |

`sheet.renameName` looks at the sheet's own names only: a workbook name is not one of them.

When `newName` is `oldName` ignoring case, nothing at all happens: no formula is rewritten (not
even to the new spelling), no undo list changes, and it returns `0`. This is NOT what
`renameSheet` does (checkpoint 37 writes a case-only rename into formulas).

## Rewriting

- A formula uses the name where its text names it and no `LET` (checkpoint 62) hides it: the same
  rule as precedents (checkpoint 10) and lint (checkpoint 73). Each such use, in any case, is
  written as `newName` exactly as typed; the rest of the formula keeps its text. A `LET`'s own name
  and the uses that name hides are not touched, so with a sheet name `RATE`,
  `=LET(rate, 3, rate) + rate` becomes `=LET(rate, 3, rate) + NewRate`. This is NOT what a search
  and replace of the text would do. A `LET` whose arguments are not valid (checkpoint 62) defines
  no name, so a name written where its name would stand is an ordinary use: `=LET(rate, 2)`
  becomes `=LET(NewRate, 2)`.
- Strings, function names (`RATE(...)` is a call), sheet names before `!` (a sheet called `Rate`,
  in `=Rate!A1`), and formulas that do not parse are never rewritten. Values are never rewritten.
- A formula that already named `newName` (and gave `#NAME?`) now uses the renamed name.
- `book.renameName` does not rewrite the formulas on a sheet that has its own name of `oldName`:
  there the name means the sheet's own name, which is not renamed. On a sheet that has its own
  name of `newName`, rewritten formulas then use that sheet name (checkpoint 53). This is NOT what
  you might expect.
- Rewritten inputs are not checked: a protected cell (checkpoint 71) is rewritten like any other,
  and a formula that the longer name takes past the limits of checkpoint 67 is kept as rewritten.
  This is NOT what you might expect.
- Each sheet with rewritten inputs gets one change event (checkpoint 65) listing them. The events
  are fired sheet by sheet in `sheetNames()` order.

## Undo and saving

- `sheet.renameName` is one undo step, labelled `"renameName"` (checkpoint 76): undoing it puts back
  the old name and every rewritten input. This is NOT what `renameSheet` does.
- `book.renameName` is not undoable. Like `renameSheet`, it clears the undo and redo lists of every
  sheet and of the workbook names, even when it rewrites nothing.
- `names()`, `book.names()`, `save()` and `book.save()` give the name under its new name, with the
  same target.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
