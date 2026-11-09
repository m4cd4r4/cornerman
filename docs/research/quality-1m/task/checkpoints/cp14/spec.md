# Checkpoint 14: named ranges

## API

- `sheet.defineName(name, ref)`: `ref` is a cell address (`"B2"`) or a range (`"A1:B3"`, either
  corner first), case-insensitive, no `=` and no spaces. Defining an existing name replaces it.
- `sheet.removeName(name)`: removes it. Returns `true` if the name existed, otherwise `false`.
- `sheet.names()`: a plain object mapping each name, upper case, to its target, in sorted key
  order. A cell target is its upper-case address (`"B2"`). A range target is written top-left
  corner, then bottom-right (`"B3:A1"` is stored as `"A1:B3"`).

## Valid names

- A letter or `_`, then letters, digits or `_`. Case-insensitive: `rate` and `RATE` are one name.
- Not `TRUE` or `FALSE`, and not letters followed only by digits (`A1`, `TAX2024`, `ABC12` are
  all invalid; `TAX_2024` and `T2X` are valid).
- An invalid name makes `defineName` throw `{ code: "#BADNAME", cell: <name as passed>, message }`.
  An invalid `ref`, or a range of more than 10,000 cells, throws the `#ADDR` error with `cell` =
  the `ref` as passed.
- A name may equal a function name: `SUM` as a bare word is the name, `SUM(` is the function.

## In formulas

- A name for a cell acts exactly like a reference to that cell.
- A name for a range acts like that range: fine as a function argument, `#VALUE!` anywhere else.
  This holds even for a one-cell range defined as `"A1:A1"`.
- As a function argument, any name is a range argument (checkpoint 13), including a cell name.
- A name that is not defined is `#NAME?` (checkpoint 7).
- A formula that uses a name refers to the cells of the name's current target (checkpoints 9 and
  10). Defining, redefining or removing a name changes that, and the formulas using the name (and
  their dependents) need evaluation again. No other formula does.
