# Checkpoint 76: undo history labels

Every undo step now carries a label, and sheets and workbooks can list the steps `undo` and `redo`
would take, without taking them.

## API

- `sheet.undoList()`: an array of labels (strings), one for each step on the sheet's undo list
  (checkpoint 27), the step `undo()` would take next first. `[]` when there is nothing to undo.
- `sheet.redoList()`: the same for the redo list, the step `redo()` would take next first.
- `book.undoList()` and `book.redoList()`: one object `{ sheet, label }` for each step of every
  list the workbook looks at (checkpoint 55), in the order repeated calls of `book.undo()` (or
  `book.redo()`) would take them. `sheet` is the name of the step's sheet as `sheetNames()` gives
  it now, or `null` for a step on the workbook names list.

All four return new arrays, change nothing and are not undo steps.

## Labels

- A step's label is the name of the method you called that made it, exactly as you called it:
  `"set"`, `"setCell"`, `"setMany"`, `"copy"`, `"fromCSV"`, `"insertRows"`, `"defineName"`,
  `"setFormat"`, `"sort"`, `"fillDown"`, `"replace"`, `"clear"`, and so on, for every method that
  makes an undo step. Methods that do the same thing keep their own names: a step made by `set`
  is `"set"` and one made by `setCell` is `"setCell"`. This is NOT what you might expect.
- A step made by `book.copy` (checkpoint 68) is `"copy"`, on the target sheet's list. A step on the
  workbook names list is `"defineName"`, `"defineConstant"` or `"removeName"`.
- A step made inside `book.batch(fn)` (checkpoint 66) is labelled with the method `fn` called,
  never `"batch"`. This is NOT what you might expect. A step made by a change listener
  (checkpoint 65) is labelled with the method the listener called.
- `undo` and `redo` move a step from one list to the other with its label unchanged.

## The lists

- A sheet's lists hold that sheet's steps only. They hold at most 100 steps (checkpoint 27); a
  step dropped by the limit is gone from the list too.
- `book.undoList()` is ordered by time across all sheets and the workbook names list, newest
  first, exactly as `book.undo()` would take the steps: it is NOT one sheet after another. This is
  NOT what you might expect. `book.redoList()` is ordered by the time each step was undone, most
  recent first. A sheet removed from the workbook takes its steps with it.
- Everything that clears or restores the lists does so for the labels too: `book.renameSheet` and
  `book.deleteSheet` clear them (checkpoints 37 and 54), a batch that rolls back puts back the
  lists as they were, and a loaded sheet or workbook starts with empty lists.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
