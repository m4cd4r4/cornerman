# Checkpoint 15: AVERAGE, MIN, MAX, COUNT

`AVERAGE`, `MIN` and `MAX` take arguments exactly like `SUM` (checkpoint 13): range arguments
contribute only their numbers; direct arguments contribute numbers and booleans (1 / 0), and direct
text is `#VALUE!`. Errors follow the checkpoint 4 rules.

- `AVERAGE`: the sum of the contributed numbers divided by how many there are. Skipped cells (text,
  booleans, empty cells in ranges) are not counted. No numbers at all is `#DIV/0!`.
- `MIN`, `MAX`: the smallest or largest contributed number. No numbers at all is `#VALUE!`
  (`cell` = the formula cell). This is NOT what Excel does (Excel gives 0).

`COUNT` is different from the other four:

- It counts numbers only: number values in range arguments, and direct arguments whose value is a
  number. Booleans are never counted, not even as direct arguments. Direct text is not an error;
  it is not counted.
- It skips error values: an error in a range cell, or a direct argument whose value is an error, is
  not counted and does not make COUNT an error.
- The only errors COUNT can give come from the arguments themselves, not their values: a range that
  is `#REF!` (checkpoint 13), or an undefined name used as an argument (`#NAME?`).
- `COUNT()` is `0`.
