# Checkpoint 43: COUNTIF and AVERAGEIF

Two more functions that test each cell of a range against a criterion, with exactly the criteria
of `SUMIF` (checkpoint 22).

## COUNTIF

`COUNTIF(range, criterion)`: the number of cells in `range` that meet `criterion`.

- Exactly two arguments; any other number is `#VALUE!` (`cell` = the formula cell).
- `range` is a range argument (a bare range, a bare reference, or a name), as for `SUMIF`. Any
  other expression is `#VALUE!`; a bad range is `#REF!` as in checkpoint 13.
- Both arguments are evaluated, and errors among them follow the checkpoint 4 rules.
- An empty cell is counted when the criterion means "blank" (checkpoint 22), and only then.

## AVERAGEIF

`AVERAGEIF(range, criterion)` or `AVERAGEIF(range, criterion, averageRange)`: the mean of the
numbers in `averageRange` at the positions where the cell in `range` meets `criterion`. Without
`averageRange`, the numbers in `range` itself are used.

- Two or three arguments; any other number is `#VALUE!`. Argument rules as for `SUMIF`.
- `averageRange` must have the same width and height as `range`, otherwise `#VALUE!` (`cell` = the
  formula cell). Positions are matched row by row, left to right. This is NOT what Excel does
  (Excel resizes `averageRange` from its top-left cell to the size of `range`).
- At a matching position, a number in `averageRange` is added and counted. Text, booleans and
  empty cells there are skipped, and not counted.
- An error at a matching position in `averageRange` is collected; if any were collected, the
  winner by the checkpoint 4 rules is the result. Errors at positions that do not match are
  ignored.
- When no number was counted, the result is `#DIV/0!` (`cell` = the formula cell).

## The criterion (as checkpoint 22, restated)

- Matching is type-strict. The criterion `"5"` (or `5`, or `"=5"`) matches the number 5, never
  the text `"5"`; `"apple"` matches text ignoring case; `TRUE` matches the boolean only, and the
  text `"TRUE"` is text. `*` and `?` are ordinary characters. This is NOT what Excel does (Excel
  counts the text `"5"` for the criterion `"5"`, and treats `*` and `?` as wildcards).
- An error cell in `range` never meets any criterion, `<>` included. So `COUNTIF(A1:A3, "<>x")`
  does not count an error cell, and an error in `range` is never the result of either function.
  This is NOT what you might expect.
- A criterion is compared with the value of the cell, not its display: a cell holding `0.5` with
  the format `0%` (checkpoint 41) meets `0.5`, not `"50%"`.

## Other rules

- Every cell of `range` and `averageRange` is referred to by the formula (checkpoints 9 and 10),
  so they appear in `precedents`, a cell on its own range is a cycle, and insert and delete
  rewrite the ranges as in checkpoints 23-25.
- Ranges may be on another sheet of a workbook (`Data!A1:A9`, checkpoint 31).

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
