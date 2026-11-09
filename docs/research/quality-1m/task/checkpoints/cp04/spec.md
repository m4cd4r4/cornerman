# Checkpoint 4: error propagation and priority

## Propagation

- When an operand is an error value, the result is that same error: same `code`, same `cell`
  (where it arose), same `message`. A formula that reads a `#DIV/0!` from B1 returns an error whose
  `cell` is `B1`, not its own address.
- A formula whose own input is an error code typed as text (for example the text `#VALUE!`) is
  just text. Only computed errors propagate.

## Priority (this is NOT what Excel does)

Every operand of an expression is evaluated, even after an error is found. When more than one
error is present anywhere in the expression, the result is the error with the highest priority:

`#REF!` > `#NAME?` > `#VALUE!` > `#DIV/0!`

(`#PARSE!` never mixes with others: a formula that does not parse is `#PARSE!` as a whole.)

If two errors have the same code, the result is the one whose `cell` comes first in row-major
order (the same order as `cells()`).

Example: `=1/0 + A1`, where A1 holds a `#VALUE!` that arose in A1, gives that `#VALUE!` (origin A1),
even though the division by zero comes first.

Later checkpoints add more error codes. Each one states where it sits in this order.
