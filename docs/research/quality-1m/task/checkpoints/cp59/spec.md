# Checkpoint 59: NETWORKDAYS

`NETWORKDAYS(start, end)` or `NETWORKDAYS(start, end, holidays)`: the number of working days from
`start` to `end`, both included. A working day is a Monday, Tuesday, Wednesday, Thursday or Friday
(checkpoint 58: serial 1, 2000-01-01, was a Saturday) that is not one of the holidays.

## Arguments

- Two or three arguments. Any other number is `#VALUE!` (`cell` = the formula cell).
- `start` and `end` are read as in arithmetic, truncated toward zero, and must then be 1 to
  2921940, as `start` is for `EDATE` (checkpoint 58). Otherwise `#VALUE!` (`cell` = the formula
  cell).
- `holidays` must be a range argument: a bare range, a bare reference, or a name for cells
  (checkpoints 13, 14 and 53), on this sheet or another. Any other expression is `#VALUE!` (`cell`
  = the formula cell) and is not evaluated, as for `SUMPRODUCT` (checkpoint 45): a single date such
  as `NETWORKDAYS(a, b, DATE(2024, 1, 1))` is `#VALUE!`, and so is `NETWORKDAYS(1, 9, 1/0)`. This is
  NOT what Excel does (Excel takes a single date there). A constant (checkpoint 52) is `#VALUE!`
  there too. A bad range is `#REF!` as in checkpoint 13, and so is a holidays argument that a
  delete (checkpoints 24 and 25) turned into `#REF!`.

## Counting

- Each number in a holidays cell, truncated toward zero, is a holiday. A holiday removes its day
  from the count only when that day is a working day from `start` to `end`. A holiday on a Saturday
  or Sunday, or outside the two dates, changes nothing, and a day listed more than once is removed
  once. Holiday numbers need not be valid serials: 0, -3 or 1e9 are allowed and change nothing.
- Text (even text that looks like a number), booleans and empty cells in the holidays are skipped.
  This is NOT what Excel does (Excel gives `#VALUE!` for text in the holidays).
- An error in a holidays cell is not skipped. Errors in `start`, in `end`, a bad holidays range and
  every error cell in the holidays are gathered, and the winner by the checkpoint 4 rules (or the
  checkpoint 34 order) is the result. Errors win over the date checks: `NETWORKDAYS(0, nope)` is
  `#NAME?`.
- Any two dates of the calendar may be used, even the first and the last.

## How it meets earlier checkpoints

- Every holidays cell is referred to by the formula (checkpoints 9 and 10), and the formula gives a
  new value when one of them changes.
- Hidden rows and columns (checkpoint 49) change nothing: a holiday in a hidden row still counts.
  Among the functions, only `SUBTOTAL` (checkpoint 50) leaves hidden rows out. A cell covered by a merge (checkpoint 47)
  reads as empty, so it is skipped.
- The holidays range is a reference like any other: insert, delete (checkpoints 23-25) and copy
  (checkpoint 26) move it, and a workbook name (checkpoint 53) for it is never moved.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
