# Checkpoint 45: SUMPRODUCT

`SUMPRODUCT(range1, range2, ...)`: multiplies the cells at the same position in each range and
adds the products.

## Arguments

- One or more arguments; none is `#VALUE!` (`cell` = the formula cell).
- Every argument must be a range argument: a bare range, a bare reference (a 1 x 1 range) or a
  name. Any other expression is `#VALUE!` (`cell` = the formula cell) and is not evaluated, so
  `SUMPRODUCT(1/0)` is `#VALUE!`, not `#DIV/0!`. That includes array arithmetic such as
  `SUMPRODUCT((A1:A3>1)*B1:B3)` and plain numbers such as `SUMPRODUCT(2, 3)`. This is NOT what
  Excel does (Excel evaluates such arguments as arrays or single values).
- A bad range is `#REF!` and an unknown name is `#NAME?`, as in checkpoint 13. When several
  arguments are wrong, the winner by the checkpoint 4 rules is the result.
- All ranges must have the same width and the same height, otherwise `#VALUE!` (`cell` = the
  formula cell). A one-row range and a one-column range of the same length are not the same
  shape.

## Values

- Positions are matched row by row, left to right, in each range.
- A number counts as itself. A boolean counts as 1 (`TRUE`) or 0 (`FALSE`). This is NOT what
  Excel does (Excel counts booleans in ranges as 0).
- Text (even text such as `"5"`), the text `""`, and empty cells count as 0.
- If any cell of any range holds an error, the result is the winning error by the checkpoint 4
  rules among all of them, wherever they are and whatever the other factors at their position.
- The products are added in position order, starting from 0.

## Other rules

- Every cell of every range is referred to by the formula (checkpoints 9 and 10).
- Insert and delete rewrite each range on its own, as in checkpoints 23-25, so deleting a column
  inside only one of the ranges can leave them with different shapes, which is `#VALUE!`.
- Ranges may be on another sheet of a workbook (checkpoint 31).

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
