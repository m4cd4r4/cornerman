# Checkpoint 54: deleting a sheet

`removeSheet` (checkpoint 31) takes a sheet out of a workbook and leaves every formula that names it
as it was, so a sheet added later with that name is read again. A workbook can now also delete a
sheet for good: the references to it are rewritten as `#REF!`.

## API

- `book.deleteSheet(name)`: deletes the sheet called `name` (matched ignoring case, as
  `book.sheet` matches). Returns the number of cells, on the sheets still in the book, whose input
  was rewritten.
- When there is no such sheet (including when `name` is not a string), it throws `#SHEET` with
  `cell` = `String(name)` and changes nothing.

## The deleted sheet

- It leaves the book exactly as with `removeSheet`: `sheetNames()` no longer lists it, and the
  sheet object keeps working on its own as a sheet in no workbook, with its own inputs, names and
  layers unchanged (its references to sheets, its own name included, give `#REF!`).
- Deleting the only sheet is allowed: the book then has no sheets. This is NOT what Excel does
  (Excel refuses to delete the last sheet).

## Formulas on the other sheets

- In every formula of every sheet still in the book, each reference whose sheet name is the
  deleted sheet's (matched ignoring case) is replaced by the text `#REF!`: a cell reference
  (`Data!B2`, `data!$B$2`) and a whole range (`Data!A1:B3`, one `#REF!` for the range, its sheet
  name, both corners and the `:`). Nothing else in the input changes: not spaces, not the case of
  other words, not string literals (`"Data!A1"` stays). `=SUM(Data!A1:A3, B1) + data!C1` becomes
  `=SUM(#REF!, B1) + #REF!`.
- Inputs that are not formulas, and formulas that do not parse, are not changed. References to
  other sheets, including sheets that do not exist, are not changed.
- Every value is then what the new text gives (checkpoint 23: `#REF!` in a formula is the
  `#REF!` error). A sheet added later with the deleted sheet's name is NOT read by these formulas;
  that is the difference from `removeSheet`.

## Workbook names

- Every workbook name (checkpoint 53) whose target is on the deleted sheet is removed from the
  book. A formula that used it then gives `#NAME?`, unless its own sheet has a name of that name.
  This is NOT what Excel does (Excel keeps the name, pointing at `#REF!`). Workbook constants and
  names on other sheets are kept. Each sheet's own names never point at another sheet and are
  kept.

## Undo

A delete is not recorded for undo. It clears the undo and redo lists of every sheet that was in
the book, the deleted one included, as `renameSheet` does (checkpoint 37).

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
