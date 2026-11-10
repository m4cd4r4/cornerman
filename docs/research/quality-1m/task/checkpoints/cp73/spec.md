# Checkpoint 73: lint

A sheet can now list two kinds of likely mistakes in its formulas: names it defines that nothing
uses, and references to cells that hold nothing.

## API

`sheet.lint()` returns an array of findings, `[]` when there are none. Each finding is one of:

- `{ kind: "unused-name", name }`: a name the sheet itself defines (`defineName`, checkpoint 14, or
  `defineConstant`, checkpoint 52) that no formula on the sheet uses. `name` is upper case, as
  `names()` gives it.
- `{ kind: "empty-ref", address, ref }`: the formula in `address` (upper case) writes a one-cell
  reference to `ref`, and `ref` is empty. `ref` is written as `precedents()` labels a cell
  (checkpoint 32): plain (`B1`) on the formula's own sheet, also when the reference names its own
  sheet (`Main!B1` written on `Main`), and `Name!B1` for another sheet of the workbook, with the
  sheet's name as the workbook has it (`data!b1` written in a formula, on a sheet added as `Data`,
  is `Data!B1`). `$` marks are not part of it.

`lint` reads formula text only. It evaluates nothing (`stats().evaluations` does not change,
checkpoint 8), changes nothing, and is not an undo step.

## The order

Every `unused-name` finding comes first, sorted by name. Then the `empty-ref` findings, by
`address` row-major; for one address, by `ref` in the order `precedents()` gives (cells of the
formula's own sheet row-major, then other sheets in the order they were added). The same `address`
and `ref` are listed once, however many times the formula writes that reference.

## Unused names

- A name is used when some formula on the sheet uses it exactly as checkpoint 10 counts a
  precedent: where the formula's text names it and no `LET` (checkpoint 62) hides it. With a sheet
  constant `RATE`, the formula `=LET(rate, 2, rate * A1)` does not use it, so `RATE` is unused.
  This is NOT what you might expect.
- Whether the use gives a value or an error does not matter: `=SPAN` that is `#VALUE!` because
  `SPAN` is a range used outside a function (checkpoint 14) still uses it.
- Text inside a string literal is not a use (`="RATE"`), and a formula that does not parse
  (`#PARSE!`) uses nothing.
- Only the sheet's own names are listed. Workbook names (checkpoint 53) are never listed by
  `sheet.lint()`, and a formula that uses a workbook name does not use any sheet name.

## Empty references

- Only one-cell references written in the formula count. A cell inside a range (`A1:A3`), and the
  cells a defined name points at, are never listed, even when they are empty: `=SUM(A1:A3)` with
  `A2` empty gives no finding. This is NOT what you might expect.
- Every one-cell reference in the text counts, also one in an `IF` branch that is not taken
  (`=IF(TRUE, 1, B9)` lists `B9` when it is empty) or in any argument a function ignores. This is
  NOT what you might expect: `lint` does not care whether the cell would ever be read.
- A cell is empty when it holds no input, or when it is a covered cell of a merge (checkpoint 47),
  which reads as empty even when it keeps a hidden input. A cell holding any input, a formula
  included, is not empty, whatever its value. Cells in hidden rows and columns (checkpoint 49) are
  treated like any other.
- A reference to a sheet that is not in the workbook (it gives `#REF!`, checkpoint 31) is not
  listed, and neither is anything in a formula that does not parse. A sheet made with
  `createSheet` has no other sheets, so its references to `Name!A1` are never listed.
- References are read from the text as it is now: after `insertRows`, `book.renameSheet`,
  `book.deleteSheet`, `undo` and the rest, `lint` lists what the rewritten formulas say.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
