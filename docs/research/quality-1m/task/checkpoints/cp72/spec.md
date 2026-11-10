# Checkpoint 72: error audit

A sheet and a workbook can now list every cell whose value is an error.

## API

- `sheet.errorCells()`: an array with one object `{ address, code, cell }` for each cell of the
  sheet whose value (as `get` gives it) is an error. `address` is the cell, upper case; `code` and
  `cell` are the error value's own `code` and `cell` (checkpoint 2). `[]` when there are none.
- `book.errorCells()`: the same for every sheet of the workbook (checkpoint 31), each object
  `{ sheet, address, code, cell }`, `sheet` being the sheet's name as the workbook has it.

Both evaluate every formula they need, exactly as `get` would (checkpoint 8 counts those
evaluations), and change nothing.

## Which cells

- Every cell with an input whose value is an error: a formula giving an error, a formula that does
  not parse (`#PARSE!`), a cycle member (`#CYCLE!`). An error caught by `IFERROR` is not an error
  value, and text that looks like an error (`#DIV/0!` typed as text) is text: neither is listed.
- A covered cell of a merge (checkpoint 47) reads as empty, so it is never listed. Cells in hidden
  rows and columns (checkpoint 49) are listed like any other.
- `cell` is where the error value began, which may be another cell than `address`: with `A1` =
  `=1/0` and `B1` = `=A1+1`, `B1` is listed as `{ address: "B1", code: "#DIV/0!", cell: "A1" }`.
  An error that began on another sheet keeps its own cell without a sheet name (checkpoint 31), so
  `Main!A1` = `=Data!C5` with `Data!C5` = `=1/0` lists `{ address: "A1", code: "#DIV/0!", cell:
  "C5" }`.
- On a sheet using `errorOrder: "first"` (checkpoint 34), each value is the error that option
  gives, as `get` does.

## The order

- By `code` first, in the priority order of checkpoints 4, 9 and 21, highest first: `#CYCLE!`,
  `#REF!`, `#NAME?`, `#N/A`, `#VALUE!`, `#DIV/0!`, and then `#PARSE!` last. Within one code,
  row-major by `address`. So a `#DIV/0!` in `A1` comes after a `#NAME?` in `Z99`. This is NOT what
  you might expect (a list in reading order).
- The order is always by priority, also on a sheet or workbook using `errorOrder: "first"`. This is
  NOT what you might expect.
- `book.errorCells()` orders by `code` across all sheets first, then by sheet in the order
  `sheetNames()` gives them, then row-major: every `#REF!` of every sheet comes before any
  `#NAME?`. It is NOT one sheet after another. This is NOT what you might expect.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
