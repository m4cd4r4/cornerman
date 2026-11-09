# Checkpoint 26: absolute references and copy

## Absolute references

- A reference in a formula may put `$` before its column letters, before its row number, or both:
  `$A$1`, `A$1`, `$A1`, and in lower case `$a$1`. Range corners may too: `SUM($A$1:B$2)`.
- `$` does not change what a reference reads. `$A$1`, `A$1`, `$A1` and `A1` all read cell `A1`, and
  precedents, dependents and cycles treat them alike.
- Any other use of `$` is a parse error (`#PARSE!`, checkpoint 2): `A$$1`, `$$A1`, `$A`, `A1$`,
  `$1`, `$SUM(1)`.
- Name targets (checkpoint 14) do not take `$`. `defineName("R", "$A$1")` throws `#ADDR` as before.
- Inserting and deleting rows and columns (checkpoints 23 to 25) moves absolute references exactly
  like relative ones, and keeps each `$` where it was typed: inserting a row at 1 turns `=$a$1+A$2`
  into `=$A$2+A$3`.

## API

- `sheet.copy(from, to)`: copies the inputs of `from` so that its top-left cell lands on `to`.
  `from` is one address (`"B2"`) or a range of two addresses joined by `:` (`"B2:C5"`, either
  corner first, case-insensitive). `to` is one address. It returns nothing.
- A bad `from` throws `{ code: "#ADDR", cell: from, message }`, and a bad `to` throws the same with
  `cell: to`, both exactly as passed in.
- A `from` range holding more than 10,000 cells throws `{ code: "#ARG", cell: from, message }`.
  This is NOT what Excel does.
- If any target cell would pass row 9999 or column `ZZ`, it throws `{ code: "#ARG", cell: to,
  message }`.
- Every throw changes nothing.

## What a copy writes

Each source cell's input is written to the cell at the same offset from `to`. Copying `B2:C3` to
`E5` writes `B2` to `E5`, `C2` to `F5`, `B3` to `E6` and `C3` to `F6`.

- An empty source cell clears its target. A non-formula input is copied exactly.
- In a formula, every reference is moved by the offset: the number of rows and columns from the
  top-left of `from` to `to`. A part marked with `$` does not move. Copying `=B1+$B$1+B$1+$B1`
  from `A1` to `C3` writes `=D3+$B$1+D$1+$B3`.
- A reference moved off the sheet (above row 1, past row 9999, left of column `A`, past `ZZ`)
  becomes `#REF!`. If either corner of a range would, the whole range (both corners and the `:`)
  becomes `#REF!`. Copying `=SUM(A1:B1)+$B$1` from `A2` to `B1` writes `=SUM(#REF!)+$B$1`.
- Text is rewritten as in checkpoint 23: a reference that moves is written in upper case, keeping
  its `$` marks, and everything else stays as typed. Names, function names and the inside of
  strings never change. A formula whose text is `#PARSE!` is copied exactly.
- All sources are read before any target is written, so a copy onto an overlapping range copies
  the original inputs: with `A1` = `1` and `A2` = `=A1+1`, copying `A1:A2` to `A2` leaves
  `A2` = `1` and `A3` = `=A2+1`.
- Each written cell then behaves as if `set` had been called on it (checkpoints 8 and 11): only
  cells whose input changed, and their dependents, need evaluation again.
- Defined names are never changed by a copy.
