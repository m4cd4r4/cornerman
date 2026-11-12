# Checkpoint 28: CSV export

## API

- `sheet.toCSV(opts = {})`: returns the sheet as CSV text.
- `opts.formulas`: when `true`, each field is the cell's input (`getInput`, with `""` for an empty
  cell). Otherwise each field is the cell's display text (`display`, checkpoint 5).

## Shape

- The text covers a rectangle from `A1` to the lowest row and the right-most column that hold a
  non-empty cell. A sheet with only `C3` set has three rows of three fields each. An empty sheet
  returns `""`.
- Every row has the same number of fields, empty cells giving empty fields. Fields are separated by
  `,`.
- Rows are separated by a single LF (`"\n"`). There is no line end after the last row. This is NOT
  what Excel does (Excel writes CRLF).

## Quoting

- A field is wrapped in double quotes when it contains `,`, `"`, CR or LF, or when it starts or
  ends with a space. Inside a quoted field every `"` is written twice. `say "hi"` is written as
  `"say ""hi"""`, and ` pad` as `" pad"`.
- No other field is quoted. An empty field is written as nothing at all, never as `""`.

## Evaluation

- In display mode, `toCSV` reads values exactly as `display` does, so formulas that need evaluation
  are evaluated and counted in `stats()` (checkpoint 8). In formulas mode nothing is evaluated.
- `toCSV` changes nothing and is not recorded for undo (checkpoint 27).

## Coming later

- When hidden rows and columns arrive, `toCSV` (in both modes) leaves hidden rows and hidden
  columns out entirely: no record for a hidden row, no field for a hidden column. The rectangle is
  worked out first as now, hidden cells counted, and only then are its hidden rows and columns
  removed, so when no row or no column is left the text is empty.
- When a JSON range export arrives, we agree: its `range` text is the top-left corner, `:`, the
  bottom-right corner, in upper case, and it always has two corners, so one cell `B2` is written
  `B2:B2`.
