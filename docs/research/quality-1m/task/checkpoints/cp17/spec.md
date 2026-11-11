# Checkpoint 17: IF, AND, OR, NOT

## Conditions

A value is read as a condition like this:

- A boolean is itself.
- A number is `FALSE` when it is 0, otherwise `TRUE`.
- An empty cell is `FALSE`.
- Text is `#VALUE!` (`cell` = the formula cell), even the text `"TRUE"`. This is NOT what Excel
  does.
- An error stays that error.
- A range, or a name for a range, is not a value: as the condition of `IF` or the argument of
  `NOT` it is `#VALUE!` (checkpoint 13).

## IF

`IF(condition, then)` or `IF(condition, then, else)`.

- Two or three arguments. Any other number is `#VALUE!` (`cell` = the formula cell).
- The condition is evaluated first. If it is an error, that error is the result.
- Only the chosen branch is evaluated, so an error in the other branch has no effect:
  `IF(TRUE, 1, 1/0)` is 1.
- With no `else`, a false condition gives `FALSE`.
- The branches are values: a branch that is a range is `#VALUE!` (checkpoint 13), and a branch that
  is a reference behaves exactly like that reference (so `=IF(TRUE, B1)` with `B1` empty is 0).
- Every reference in an `IF`, in every branch, is referred to by the formula (checkpoints 9 and 10),
  whichever branch runs. So `IF(TRUE, 1, A1)` in cell `A1` is `#CYCLE!`.

## AND and OR

`AND(args...)` is `TRUE` when every value counted is true. `OR(args...)` is `TRUE` when at least one
is. Arguments come in the same two kinds as in `SUM` (checkpoint 13):

- **Range arguments** (a bare range, a bare reference, or a name): booleans and numbers in those
  cells are counted, as conditions. Text and empty cells are skipped.
- **Direct arguments** (any other expression): read as conditions, so text is `#VALUE!`.
- If no value at all was counted (`AND()`, or only text and empty cells), the result is `#VALUE!`
  (`cell` = the formula cell).
- Every argument is evaluated, even when the answer is already known: `AND(FALSE, 1/0)` is
  `#DIV/0!`. Errors follow the checkpoint 4 rules.

## NOT

`NOT(x)`: exactly one argument, read as a condition, then flipped. `NOT(A1)` with `A1` empty is
`TRUE`. Any other number of arguments is `#VALUE!` (`cell` = the formula cell).
