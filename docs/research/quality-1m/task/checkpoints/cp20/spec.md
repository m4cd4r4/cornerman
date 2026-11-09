# Checkpoint 20: ISERROR and IFERROR

## ISERROR

`ISERROR(x)`: `TRUE` if `x` evaluates to any error value, otherwise `FALSE`.

- Exactly one argument. Any other number is `#VALUE!` (`cell` = the formula cell), not `TRUE`.
- `x` is a value, so a range (or a name for a range) is `#VALUE!` and `ISERROR(A1:A3)` is `TRUE`.
- Every error counts, including `#CYCLE!` and `#PARSE!` read from another cell.

## IFERROR

`IFERROR(x, fallback)`: the value of `x`, unless it is an error, in which case the value of
`fallback`.

- Exactly two arguments. Any other number is `#VALUE!` (`cell` = the formula cell).
- `fallback` is evaluated only when it is needed. If it is needed and is itself an error, that error
  is the result.
- `#CYCLE!` is never caught: if `x` is `#CYCLE!`, so is the result. Every other error is caught.
  This is NOT what Excel does (Excel has no cycle error value to pass through).
- A formula that is itself part of a cycle is `#CYCLE!` whatever it contains (checkpoint 9).
- As with `IF`, every reference in both arguments is referred to by the formula (checkpoints 9 and
  10), whether or not `fallback` runs.
