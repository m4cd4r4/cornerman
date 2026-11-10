# Checkpoint 66: batches with rollback

A workbook (checkpoint 31) can now run a function as a batch: if the function throws, everything
it changed in the workbook is put back.

## API

- `book.batch(fn)`: calls `fn(book)` once and returns what `fn` returns.
- If `fn` throws, the workbook is rolled back (below) and the very same thrown value is thrown
  again from `batch`, unchanged.
- An error that `fn` catches itself is not a throw out of `fn`: nothing is rolled back.

## While fn runs

- Every change is applied at once, exactly as outside a batch: `get`, `display`, `precedents` and
  every other read inside `fn` see the changes made so far.
- Each change keeps its own undo step (checkpoints 27 and 55). A batch is NOT one undo step: after a
  batch that made three `set` calls, `book.undo()` undoes only the last of them. This is NOT what
  you might expect.
- Change events (checkpoint 65) are not delivered while `fn` runs. The whole batch is one call: when
  it ends, each sheet whose inputs differ from before the batch gets one event listing those cells,
  sheets in the order the batch first wrote to them. A batch that is rolled back fires no event for
  the sheets of this workbook.
- `book.addSheet`, `book.removeSheet`, `book.renameSheet`, `book.deleteSheet` and `book.batch` throw
  `#BATCH` when called while `fn` runs (`cell` = the method name, such as `"addSheet"`), changing
  nothing. Thrown out of `fn`, that error rolls the batch back like any other. This is NOT what you
  might expect (a nested batch is refused, not joined).

## Rollback

When `fn` throws, before `batch` throws:

- Every sheet of the workbook gets back its inputs, defined names, formats, notes, validation
  rules, merges and hidden rows and columns exactly as they were when the batch began, and every
  formula gives the value it gave then.
- Every sheet's undo and redo lists, and the workbook's own list of name changes (checkpoint 55),
  are put back exactly as they were: an undo or redo that was possible before the batch is
  possible again, and steps made inside the batch are gone. `book.undo()` then undoes what it would
  have undone before the batch.
- The workbook names (checkpoint 53) are put back as they were.
- Only this workbook is rolled back. A sheet made by `createSheet`, a sheet of another workbook,
  and a sheet removed from this workbook before the batch keep any change `fn` made to them (and
  their events are delivered when the batch ends). This is NOT what you might expect.
- `stats().evaluations` (checkpoint 8) is not put back; how many cells are evaluated again is not
  specified.

## Errors

`batch` checks, in this order, and throws at the first failure, calling nothing:

| Check | `code` | `cell` |
| --- | --- | --- |
| no batch of this workbook is running | `#BATCH` | `"batch"` |
| `fn` is a function | `#ARG` | `String(fn)` |

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
