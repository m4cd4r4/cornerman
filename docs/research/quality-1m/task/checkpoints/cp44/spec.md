# Checkpoint 44: INDEX and MATCH

`INDEX` reads a cell of a range by its position; `MATCH` finds the position of a value in a row or
column. Together they look up in any direction.

## INDEX

`INDEX(range, row)` or `INDEX(range, row, col)`: the value of the cell at that position in
`range`, counting from 1 at its top-left cell.

- Two or three arguments; any other number is `#VALUE!` (`cell` = the formula cell).
- `range` is a range argument (a bare range, a bare reference, or a name), as for `SUMIF`
  (checkpoint 22). Any other expression is `#VALUE!`; a bad range is `#REF!` as in checkpoint 13.
- `row` and `col` are read as in arithmetic (checkpoint 3) and truncated toward zero, as
  checkpoint 18 does. `col` defaults to 1.
- The second argument is always the row, whatever the shape of the range: `INDEX(A1:C1, 2)` is
  `#REF!`, not `B1`. This is NOT what Excel does (Excel reads a lone index on a one-row range as
  the column).
- A row or column below 1 or past the edge of the range is `#REF!` (`cell` = the formula cell).
  That includes 0: there is no "whole row" or "whole column" form.
- The result is the cell's value, as a reference to it would give: an empty cell gives 0 in the
  formula cell (checkpoint 3), and an error in the cell is returned as it is, with its own `cell`.
- All arguments are evaluated, and errors among them follow the checkpoint 4 rules.

## MATCH

`MATCH(key, range)` or `MATCH(key, range, type)`: the position (1-based) of a cell in `range`
that matches `key`, by `type`.

- Two or three arguments; any other number is `#VALUE!`. `range` follows the INDEX rule, and must
  be one row or one column, otherwise `#VALUE!` (`cell` = the formula cell).
- `type` is read the same way (truncated toward zero) and must be -1, 0 or 1, otherwise `#VALUE!`. When it is
  left out it is 0. This is NOT what Excel does (Excel's default is 1).
- Only cells of the same type as `key` can match (numbers with numbers, text with text, booleans
  with booleans), as VLOOKUP does (checkpoint 21). Empty cells and error cells never match. An
  empty `key` matches nothing.
- Type 0: the first cell equal to `key`: numbers within the checkpoint 8 tolerance, text ignoring
  case. `*` and `?` are ordinary characters.
- Type 1: the cell holding the largest value that is less than or equal to `key`. Type -1: the
  cell holding the smallest value that is greater than or equal to `key`. Values are compared as
  in checkpoint 6. The range does not need to be sorted: the whole range is searched, and when
  several cells hold the best value, the first of them is the answer. This is NOT what Excel does
  (Excel assumes sorted data and searches by halving, so it can give another position).
- No match is `#N/A` (`cell` = the formula cell).
- All arguments are evaluated, and errors among them follow the checkpoint 4 rules.

## Other rules

- For both functions, an error in an argument comes before the function's own checks (as in
  checkpoint 21). When any argument is an error (an error value, a bad range, an unknown name, or
  a `range` that is not a range), the result is the winner among those errors by the checkpoint 4
  rules. The one-row-or-column check, the `type` check and the row and column position checks
  are made only when no argument is an error. So `MATCH(1/0, A5:A9, 7)` and
  `INDEX(A1:C3, 1/0, 9)` are both `#DIV/0!`.
- Every cell of the `range` of either function is referred to by the formula (checkpoints 9 and
  10), whichever cell is read, so it appears in `precedents`, and insert and delete rewrite the
  range as in checkpoints 23-25.
- Ranges may be on another sheet of a workbook (checkpoint 31).
- A number format (checkpoint 41) changes nothing here: `MATCH` compares values, and the value
  `INDEX` returns is shown without the format of the cell it came from.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
