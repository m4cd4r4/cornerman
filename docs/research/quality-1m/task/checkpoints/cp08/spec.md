# Checkpoint 8: number tolerance and the evaluation counter

## Tolerance

Two numbers `a` and `b` are equal when `|a - b| <= 1e-9 * max(1, |a|, |b|)`.

- `=` and `<>` use this rule: `=0.1+0.2=0.3` is `true`.
- `<` is true only when `a < b` and they are not equal under the rule; `<=` is true when `a < b`
  or they are equal. Same for `>` and `>=`.
- The rule applies only to comparisons. Arithmetic and `display` are unchanged.

## Evaluation counter

- `sheet.stats()` returns an object with an `evaluations` field: the number of times any formula
  cell has been evaluated since the sheet was created. Each call returns a new object; an object
  returned earlier does not change.
- `set` never evaluates anything. Evaluation happens only inside `get` and `display`.
- Calling `get` or `display` on a formula cell whose inputs have not changed since its last
  evaluation does not evaluate it again. `set` on any cell may mark every formula as needing
  evaluation; a later checkpoint narrows this.
