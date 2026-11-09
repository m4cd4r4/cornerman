# Checkpoint 11: incremental recalculation

Checkpoint 8 allowed `set` to mark every formula as needing evaluation. That is now narrowed.

- After `set(X, ...)`, the only formula cells that need evaluation again are `X` itself (if it is
  a formula) and the transitive dependents of `X` (checkpoint 10). Every other formula keeps its
  value and is not evaluated again when read.
- `set` itself evaluates nothing. Evaluation still happens when a value is read (`get`,
  `display`).
- Setting a cell to exactly the input it already holds changes nothing: no cell needs evaluation
  because of it. Clearing a cell that is already empty is the same.
- A formula cell is evaluated at most once per change, however many cells read it.
- `stats().evaluations` (checkpoint 8) is how this is measured.
