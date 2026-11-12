# Checkpoint 60: CHOOSE and SWITCH

Two functions that pick one of their arguments. Like `IF` (checkpoint 17), each evaluates only what
it needs, and every reference in every argument is still referred to by the formula (checkpoints 9
and 10), whichever argument is picked. So `CHOOSE(1, 5, A1)` in cell `A1` is `#CYCLE!`.

## CHOOSE

`CHOOSE(index, value1, value2, ...)`: the value at position `index`, counting from 1.

- At least two arguments. Fewer is `#VALUE!` (`cell` = the formula cell).
- `index` is evaluated first, read as in arithmetic (checkpoint 3) and truncated toward zero:
  `CHOOSE(2.9, "a", "b", "c")` is `"b"`, `CHOOSE(TRUE, "a", "b")` is `"a"`. An error in it is the
  result. An index below 1 or past the last value is `#VALUE!` (`cell` = the formula cell).
- Only the chosen value is evaluated: `CHOOSE(1, 5, 1/0)` is 5.
- The chosen value is a value, never a range. A range there is `#VALUE!` (checkpoint 13, which also covers an invalid range), so
  `SUM(CHOOSE(1, A1:A3))` and `COUNTIF(CHOOSE(1, A1:A3), 1)` are `#VALUE!`. This is NOT what Excel
  does (Excel's CHOOSE can give a range to the function around it). A chosen reference behaves
  exactly like that reference, as an `IF` branch does.

## SWITCH

`SWITCH(value, case1, result1, case2, result2, ..., default)`: the result paired with the first case
equal to `value`. The `default` is optional.

- At least three arguments. Fewer is `#VALUE!` (`cell` = the formula cell). After `value`, the
  arguments go in pairs; when one is left over at the end, it is the `default`.
- `value` is evaluated first. An error in it is the result.
- Then the cases are evaluated one at a time, in order. The first case equal to `value` stops the
  search, and only its result is evaluated. An error in a case that is reached is the result, even
  when a later case would match: `SWITCH(2, 1/0, "a", 2, "b")` is `#DIV/0!`. Cases after the match,
  results of other cases, and the `default` when a case matched, are never evaluated.
- With no match, the `default` is evaluated and is the result. With no match and no `default`, the
  result is `#N/A` (`cell` = the formula cell), which sits in the error priority order of
  checkpoint 21.
- Equal means: the same type and the same value. An empty cell, as `value` or as a case, counts as
  the number 0. Numbers are equal within the checkpoint 8 tolerance. Booleans are equal when both are
  `TRUE` or both `FALSE`. A number is never equal to text or a boolean: `SWITCH("5", 5, "n", "t")` is
  `"t"`.
- Text is equal only with the same case: `SWITCH("a", "A", 1, 2)` is 2. This is NOT what Excel does
  (Excel ignores case, as `=` does in checkpoint 6). `"a" = "A"` is still `TRUE`.
- A range as `value`, a case or a picked result is `#VALUE!`, as for any value.

## How they meet earlier checkpoints

- Neither function evaluates a cell that only an unpicked argument reads: with `B1` = `=1+1` never
  read before, reading `=CHOOSE(1, 5, B1)` adds 1 to `stats().evaluations`, not 2 (checkpoint 8).
- References inside them move with insert, delete and copy, and sheet names in them follow
  `renameSheet`, like any other reference.
- Names and constants (checkpoints 14, 52 and 53) may be used in any argument. A name for a range is
  `#VALUE!` where it is picked as a value.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
