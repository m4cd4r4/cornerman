# Checkpoint 13: function syntax and SUM over ranges

## Function calls

- `NAME(arg, arg, ...)`: a word immediately followed by `(` is always a function call, even when
  the word looks like a cell reference (`LOG10(1)` is a call to `LOG10`, not cell `LOG10`).
- Function names are case-insensitive. A function name is a letter followed by letters, digits
  or `.`; anything else before `(` is `#PARSE!`.
- Arguments are any expressions, separated by commas. Zero arguments are allowed: `SUM()`. An
  empty argument (`SUM(1,,2)`, `SUM(1,)`) is `#PARSE!`.
- A function that does not exist evaluates to `#NAME?` (`cell` = the formula cell) without
  evaluating its arguments. In a larger expression it takes part in the priority order like any
  other error.

## Ranges

- `A1:B3` is the rectangle between two corners, written either way round (`B3:A1` is the same
  range). Both corners are cell references.
- A corner that is an invalid reference (`A0:A3`) makes the range `#REF!` (`cell` = the formula
  cell). So does a range of more than 10,000 cells.
- A range may only be used as a function argument. Anywhere else (`=A1:A3`, `=A1:A2+1`) it is
  `#VALUE!` (`cell` = the formula cell). This is NOT what Excel does.
- `#REF!` comes first: an invalid or over-size range is `#REF!` wherever it is written, also
  outside a function argument. `=A0:A2` and `=A0:A2+1` are `#REF!`, not `#VALUE!`.
- Every cell of a valid range is referred to by the formula (checkpoints 9 and 10), including
  empty ones. An invalid or over-size range refers to no cells.

## SUM

`SUM(args...)` adds numbers. There are two kinds of argument, and they behave differently:

- **Range arguments**: an argument that is a bare range or a bare single reference
  (`SUM(A1:A3)`, `SUM(B2)`). Only number values in those cells are added. Text, booleans and
  empty cells are skipped.
- **Direct arguments**: any other expression (`SUM(1, A1+0, TRUE)`). A number is added, a boolean
  adds 1 or 0, and text is `#VALUE!` (`cell` = the formula cell), even text that looks like a
  number. This is NOT what Excel does.
- Error values anywhere (in range cells or from direct arguments) follow the checkpoint 4 rules:
  every argument is evaluated, and the error with the highest priority wins.
- `SUM()` is `0`.
