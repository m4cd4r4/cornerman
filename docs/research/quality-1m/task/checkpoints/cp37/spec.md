# Checkpoint 37: renaming a sheet

A workbook (checkpoint 31) can now rename one of its sheets. Every formula in the book that names
the sheet is rewritten to use the new name.

## API

- `book.renameSheet(oldName, newName)`: renames the sheet called `oldName` (matched ignoring case,
  as `book.sheet` matches) to `newName`. Returns `undefined`.

## What changes

- The sheet object is the same one: `book.sheet(newName)` returns the object `book.sheet(oldName)`
  returned before. `sheetNames()` keeps its order and gives the sheet's name as `newName` is
  typed.
- In every formula of every sheet in the book, the sheet included, each sheet prefix that names
  the old sheet (the word before `!`, matched ignoring case) is replaced by `newName` as typed.
  Nothing else in the input changes: not spaces, not the case of other words, not the text of
  string literals. `=sum( data!A1 , 1 )` becomes `=sum( Facts!A1 , 1 )`, and `="Data!A1"&Data!A1`
  becomes `="Data!A1"&Facts!A1`.
- Inputs that are not formulas are not changed, even when they look like a reference
  (`Data!A1` typed without `=`). A formula that does not parse is not changed.
- Every value is then what it would be if each formula had been typed with its new text. A
  formula that named `newName` before the rename (and so gave `#REF!`) now reads the renamed sheet.
  A formula written after the rename that names the old name gives `#REF!`, until a sheet with that
  name is added.
- `precedents` and `dependents` (checkpoint 32) give the new name in their labels.
- `book.save()` writes the new name and the rewritten inputs.
- A sheet removed from the book (checkpoint 31) is not rewritten.
- How many cells a rename evaluates again is not specified.

## Undo

A rename is not recorded for undo. Instead it clears the undo and redo lists of every sheet in the
book, so `undo()` and `redo()` on any of them return `false` until there is a new change.

A rename to exactly the name the sheet already has (same case) changes nothing and clears nothing.
A rename that only changes case (`Facts` to `FACTS`) is a rename: inputs are rewritten and the
lists are cleared.

## Errors

`renameSheet` throws, at the first of these checks that fails, in this order, and changes nothing:

| Check | `code` | `cell` |
| --- | --- | --- |
| a sheet called `oldName` exists | `#SHEET` | `String(oldName)` |
| `newName` is a valid sheet name (checkpoint 31) and a string | `#BADNAME` | `String(newName)` |
| no other sheet is called `newName`, ignoring case | `#SHEET` | `newName` as given |
