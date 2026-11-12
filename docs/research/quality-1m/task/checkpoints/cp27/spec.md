# Checkpoint 27: undo and redo

## API

- `sheet.undo()`: reverses the most recent undoable action that has not been undone. Returns
  `true`, or `false` (changing nothing) when there is nothing to undo.
- `sheet.redo()`: repeats the most recently undone action. Returns `true`, or `false` (changing
  nothing) when there is nothing to redo.

## What is undoable

An action is recorded, as one undo step, when it is one of these calls and it changed something:

- `set` that gave the cell a different input (setting a cell to the input it already holds is not
  recorded).
- `copy` (checkpoint 26), as one step however many cells it wrote. It is recorded only if at least
  one target's input changed.
- `defineName` that added a name or gave it a different target. Defining a name again with the
  same target is not recorded.
- `removeName` that returned `true`.
- `insertRows`, `deleteRows`, `insertCols`, `deleteCols` that moved, removed or rewrote at least
  one cell, formula or name. One that changed nothing is not recorded. This is NOT what Excel does.

A call that throws changes nothing and is not recorded. Reading calls (`get`, `display`, `recalc`,
`precedents`, and the rest) are never recorded.

## The rules

- Undo puts back every cell input and every defined name exactly as they were before the action.
  Redo puts back exactly what the action produced.
- Recording an action empties the redo list: after `undo()` then `set(...)`, `redo()` returns
  `false`. An action that is not recorded leaves the redo list alone.
- At most 100 actions can be undone in a row. When a 101st is recorded, the oldest is dropped.
- Undoing or redoing a `set`, `copy` or name change counts, for evaluation, as setting the cells
  or names it changes (checkpoints 8, 11 and 14): only those cells, and the formulas that depend
  on them, need evaluation again. Undoing or redoing a row or column operation is treated like the
  operation itself (checkpoint 23): every formula needs evaluation again.
- `stats()` is not undone. Evaluations made during or after an undo are counted as usual.

## Coming later

- We tried to send undo and redo through the same write path that checks protected cells, and it
  left the history half-applied. When protected cells arrive, undo and redo never check protection.
