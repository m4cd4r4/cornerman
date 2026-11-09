# Checkpoint 39: explaining a cell

A sheet can now show where a cell's value comes from: the cell, the cells its formula reads, the
cells those read, and so on, as a tree.

## API

- `sheet.explain(address)`: returns a node, below. An invalid address throws as `get` does
  (checkpoint 1).

## A node

A plain object with exactly these keys, in this order:

- `address`: the cell. A cell on the sheet `explain` was called on is written plain (`A1`); a cell
  on another sheet of the workbook is written `Name!A1`, with `Name` as `sheetNames()` gives it.
  This holds at every depth of the tree, whichever sheet the node's parent is on.
- `input`: what `getInput` gives for the cell (`null` when it is empty).
- `value`: what `get` gives for the cell.
- `from`: an array of nodes, one for each direct precedent of the cell, or `null` (see Repeats).

The top node is the cell `explain` was called on.

## The precedents

A node's `from` lists the cell's direct precedents: the same cells, in the same order, as
`precedents(address)` (checkpoints 10 and 32) gives when called on the sheet that holds the cell.
So for a cell on another sheet, the cells of that other sheet come first. A cell that is not a
formula, an empty cell, and a formula that reads no cells, have `from: []`. A reference to a sheet
that does not exist adds nothing.

## Repeats

The tree is built depth-first, a node's whole `from` before the node after it. A cell can be a
precedent of several cells, or of itself through a cycle. Only its first place in that order is
expanded; at every later place it appears with its `address`, `input` and `value` as usual and
`from: null`. The top node counts as a first place. So every cell appears with a `from` array once,
and a cycle ends where it comes back to a cell already shown.

## Other rules

- `explain` reads each value as `get` would: it evaluates what `get` would evaluate, and counts it
  in `stats()` the same way. It changes no input and is not recorded for undo.
- A chain of 9,999 formulas, each reading the one before (checkpoint 36), can be explained from its
  far end. The tree is then 9,999 nodes deep and `explain` does not throw.
