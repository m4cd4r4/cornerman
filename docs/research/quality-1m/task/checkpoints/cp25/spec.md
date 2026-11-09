# Checkpoint 25: insert and delete columns

## API

- `sheet.insertCols(at, count = 1)`: inserts `count` empty columns to the left of column `at`. Every
  cell in column `at` or to its right moves right by `count` columns, keeping its input.
- `sheet.deleteCols(at, count = 1)`: deletes columns `at` to `at + count - 1`. Their cells are gone.
  Every cell to their right moves left by `count` columns.
- `at` is a column given as its letters, one or two of them, case-insensitive: `"C"`, `"aa"`. A
  number, or anything else, is invalid. `count` is a whole number of at least 1, and the last
  column touched must not pass `ZZ`. Bad arguments throw `{ code: "#ARG", cell: String(at),
  message }` and change nothing.
- If `insertCols` would move a non-empty cell past column `ZZ`, it throws `{ code: "#FULL",
  cell: String(at), message }` and changes nothing.

## Everything else

Columns follow exactly the rules that checkpoints 23 and 24 give for rows, with "left" for "top"
and "right" for "bottom":

- References and range corners move one at a time. A range grows when columns are inserted inside
  it or at its right-most column. Columns inserted immediately to its right leave it unchanged.
- A reference pushed past column `ZZ`, or into a deleted column, becomes `#REF!`; so does a range
  pushed past `ZZ` at either corner, or with every column deleted. A range with only some columns
  deleted shrinks.
- A reference that moves is written in upper case; all other text stays as typed. Formulas whose
  text is `#PARSE!` are left alone.
- Defined names move and shrink the same way, and are removed when pushed off the sheet or wholly
  deleted.
- Afterwards every formula needs evaluation again, and precedents, dependents and cycles follow
  the new text.

Row operations never change a column, and column operations never change a row.
