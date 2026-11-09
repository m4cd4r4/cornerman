# Checkpoint 55: undo across a workbook

Each sheet keeps its own undo and redo lists (checkpoint 27). A workbook can now undo and redo
across all of its sheets, in the order the changes were made, and its own name changes
(checkpoint 53) become undoable.

## API

- `book.undo()`: undoes one step: the newest step that some list in the book would undo next.
  Returns `true`, or `false` when there is nothing to undo.
- `book.redo()`: redoes one step: the step undone most recently, among the steps some list in the
  book would redo next. Returns `true`, or `false` when there is nothing to redo.

## The lists

- The book looks at the undo and redo lists of each sheet in `sheetNames()`, and at one more list
  of its own: the workbook names list.
- Every change to the workbook names that changes something (`book.defineName`,
  `book.defineConstant`, a `book.removeName` that returns `true`) is one step on the workbook names
  list. That list is undone and redone only through `book.undo()` and `book.redo()`; `sheet.undo()`
  never touches it. It holds at most 100 steps, as a sheet's list does.
- Every step has the time it was made. A step that is redone (by `sheet.redo()` or `book.redo()`)
  counts as made at the time of the redo, and a step that is undone (by either) has the time of that
  undo. `book.undo()` takes, among the step each list would undo next, the one made last.
  `book.redo()` takes, among the step each list would redo next, the one undone last.
- A step undone or redone through the book is undone or redone exactly as its own list would do it:
  afterwards it sits on that list's redo or undo list. `sheet.undo()` and `sheet.redo()` keep working
  as before, and the book sees what they did.

## What is not one list

- A new change on a sheet clears only that sheet's redo list, as in checkpoint 27, and a change to
  the workbook names clears only the workbook names redo list. So after a change on one sheet,
  `book.redo()` can still redo a step undone on another sheet. This is NOT what Excel does (Excel
  keeps one list for the workbook, and any new change clears all redo).
- `book.undo()` undoes one step of one list. A `setMany`, `copy`, `sort` or structural change is
  one step, as on its sheet.
- `addSheet` and `removeSheet` are not steps and clear nothing. A sheet removed from the book takes
  its lists with it: its steps are never undone or redone through the book, even ones made while it
  was in the book, and they stay on the removed sheet, where `sheet.undo()` still undoes them. This
  is NOT what you might expect.
- `renameSheet` (checkpoint 37) and `deleteSheet` (checkpoint 54) clear every sheet's lists, as
  before, and the workbook names list as well.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
