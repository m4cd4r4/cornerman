# Checkpoint 31: workbooks and references to other sheets

## API

- `createWorkbook()`: a new export of `src/index.mjs` beside `createSheet` and `loadSheet`.
  Returns a workbook with no sheets.
- `book.addSheet(name)`: adds an empty sheet called `name` and returns it. The returned object
  is a sheet with every method of checkpoints 1 to 30.
- `book.sheet(name)`: the sheet called `name`. Calling it again returns the same object.
- `book.sheetNames()`: the names of the sheets, in the order they were added, written as they
  were given to `addSheet`.
- `book.removeSheet(name)`: removes the sheet called `name` and returns `true`; returns `false`
  if there is no such sheet (including when `name` is not a string).

## Sheet names

- A sheet name follows the rule for defined names (checkpoint 14): a letter or `_`, then letters,
  digits and `_`; not letters followed only by digits; not `TRUE` or `FALSE`. So `Data` and
  `Sheet_2` are valid, and `Sheet2`, `A1` and `My Sheet` are not.
- Names are compared without regard to case: `book.sheet("DATA")` finds the sheet added as
  `Data`, and `removeSheet` works the same way. `sheetNames()` still gives `Data`.

## Errors

These are thrown as `{ code, cell, message }`:

| Call | Error | `cell` |
| --- | --- | --- |
| `addSheet(name)` with an invalid name, or a name that is not a string | `#BADNAME` | `String(name)` |
| `addSheet(name)` when a sheet with that name (in any case) exists | `#SHEET` | `name` as given |
| `sheet(name)` when no sheet has that name | `#SHEET` | `String(name)` |

## References to other sheets

- In a formula, `Data!B2` is cell B2 on the sheet named `Data`, and `Data!B2:C4` is that range on
  `Data`. `$` works after the `!` as on the sheet itself: `Data!$B$2`. The sheet name in a formula
  is matched without regard to case.
- The sheet name is written once, before the first corner of a range. `Data!B2:Data!C4` is
  `#PARSE!`.
- There are no spaces around `!`, and a cell or a range must follow it. So `Data ! B2`, `Data!`,
  `Data!SUM(1)` and `Data!RATE` (a defined name) are all `#PARSE!`. A word before `!` that is not a
  valid sheet name, such as `A1!B2` or `TRUE!B2`, is `#PARSE!` too.
- A reference to another sheet can be used anywhere a reference to a cell or range on the same
  sheet can: in arithmetic, as a function argument, in a range argument (checkpoints 13 to 22).
- A sheet can name itself: on the sheet `Main`, `Main!A1` is the same cell as `A1`.
- Defined names (checkpoint 14) belong to one sheet. A formula reads only its own sheet's names.

## When the sheet is not there

- References are matched to sheets by name when the formula is evaluated. A reference to a sheet
  name that does not exist in the workbook gives `#REF!`, with `cell` = the formula's own cell. A
  range argument on a missing sheet gives `#REF!` in the same way, for every function, including
  `COUNT`.
- When a sheet with that name is added later, those formulas read the new sheet. When a sheet is
  removed, formulas that name it give `#REF!` again. Their formula text does not change.
- A sheet made with `createSheet()` or `loadSheet()` belongs to no workbook: every reference to
  another sheet in it is `#REF!`, including one that uses a name the sheet has somewhere else.
- A removed sheet keeps working as a sheet in no workbook: its own cells and values stay, and its
  references to other sheets give `#REF!`. Adding a new sheet with the same name to the workbook
  gives a new, empty sheet.

## Values read from another sheet

- A value read from another sheet is the same value that sheet's `get` returns. An error value
  keeps its own `cell`: if `Data!B2` holds `=1/0`, then `=Data!B2` on `Main` in A1 gives
  `{ code: "#DIV/0!", cell: "B2", ... }`. The sheet name is not added to `cell`.
- A formula that reads another sheet changes value when that sheet's cells change, through `set`,
  `copy`, `fromCSV`, a row or column operation, or `undo` and `redo` on that sheet.

## Row and column operations

- Inserting or deleting rows or columns (checkpoints 23 to 25) rewrites only the formulas on the
  sheet where it happens, and never rewrites a reference that has a sheet name, even one naming
  that same sheet. So after `Data.insertRows(1)`, `=Data!A1` on `Main` still reads `Data!A1`, which
  is now the new, empty row. This is NOT what Excel does: Excel moves the reference with the cell.
- A reference with a sheet name that is moved by `copy` (checkpoint 26) shifts like any other:
  `=Data!A1` copied one row down becomes `=Data!A2`, and `=Data!$A$1` stays. A reference that
  would move off the sheet becomes `#REF!` with its sheet name: `=Data!A1+1` copied from B2 to B1
  becomes `=#REF!+1`.

## Undo and history

- Each sheet keeps its own undo and redo lists (checkpoint 27). `undo()` on one sheet never
  changes another sheet's cells, though values that read the changed cells change.
- `addSheet` and `removeSheet` are not recorded for undo on any sheet.

## Unchanged

`save()` and `loadSheet` (checkpoint 30) work on one sheet as before: references to other sheets
are saved as typed, and the loaded sheet belongs to no workbook. `toCSV` writes the values that
`get` returns, including values read from other sheets.
