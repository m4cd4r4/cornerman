# Checkpoint 68: copying across sheets

A workbook (checkpoint 31) can now copy cells from one of its sheets to another.

## API

- `book.copy(from, to)`: `from` is a sheet name, `!`, then a cell or a range (`"Data!A1"`,
  `"Data!B3:A1"`, corners in any order); `to` is a sheet name, `!`, then one cell, the top-left of
  the target (`"Main!C5"`). Sheet names are matched ignoring case. Returns `undefined`.
- When both name the same sheet, `book.copy` does exactly what `copy` (checkpoint 26) does on that
  sheet, with the cells after the `!`: no sheet name is added to or removed from any reference.

## What the target gets

Between two different sheets, each source cell's input is first moved as `copy` moves it (relative
parts shift by the offset from the source's top-left to `to`, parts marked `$` stay, references
with a sheet name shift too, and a reference moved off the sheet becomes `#REF!`). A reference
whose row and column both stay where they are (an offset of 0) does not move, so it keeps the case
it was typed in (checkpoint 23). Then:

1. Every reference without a sheet name gets the **source** sheet's name, written as the workbook
   has it (as typed in `addSheet` or `renameSheet`), so it still reads the source sheet's cells.
   For a range the name is written once, before the range. `=A1*2` copied from `Data!A1` to
   `Main!B1` becomes `=Data!B1*2`. This is NOT what Excel does (Excel's copied `=A1` reads the
   target sheet).
2. Every other reference with a sheet name keeps it as typed, apart from what was stated earlier
   about copying between sheets. Defined names are copied as typed and are looked up on the target
   sheet as any name there is (checkpoints 14 and 53), so they may give another value, or
   `#NAME?`. Text, numbers, `#REF!` already in a formula, and formulas that do not parse are copied
   exactly. A reference that became `#REF!` gets no sheet name.

Everything else is as `copy`:

- All source inputs are read before any target cell is written. Empty source cells clear their
  target cells.
- Each target cell gets its source cell's number format (checkpoint 41); notes (checkpoint 42),
  validation rules (checkpoint 46), merges (checkpoint 47) and hidden rows and columns are neither
  copied nor checked, and the target may be covered by a merge.
- The limits of checkpoint 67 are not checked.
- The copy is one undo step on the target sheet, on the workbook's list like any step
  (checkpoint 55), and fires one change event (checkpoint 65) on the target sheet. The source
  sheet does not change.

## Errors

`book.copy` checks, in this order, and throws at the first failure, changing nothing:

| Check | `code` | `cell` |
| --- | --- | --- |
| `from` is a valid sheet name, `!`, and a cell or a range of two cells | `#ADDR` | `String(from)` |
| `to` is a valid sheet name, `!`, and one cell | `#ADDR` | `String(to)` |
| the book has a sheet named as in `from` | `#SHEET` | that sheet name as typed |
| the book has a sheet named as in `to` | `#SHEET` | that sheet name as typed |
| the source holds at most 10,000 cells | `#ARG` | `from` |
| the copy stays inside the sheet (rows up to 9999, columns up to ZZ) | `#ARG` | `to` |

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
