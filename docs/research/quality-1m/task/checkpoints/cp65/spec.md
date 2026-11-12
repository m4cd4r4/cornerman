# Checkpoint 65: change events

A sheet can now tell a listener when its inputs change.

## API

- `sheet.onChange(listener)`: adds `listener`, a function, to the sheet's listeners. Returns a
  function `off()`: calling it removes this listener and returns `true`; calling it again returns
  `false`. Adding the same function twice adds it twice, and each `off` removes only its own.
- A listener is called with one argument, an event object `{ cells }`: `cells` is an array of the
  addresses (upper case, as `cells()` gives them) whose input changed. Each listener gets an
  event object of its own.

## What fires an event

- An event is about **inputs only**. A cell is in `cells` when its input (as `getInput` gives it,
  an empty cell counting as `""`) just after the call differs from its input just before it. A
  cell whose value changed only because a cell it reads changed is NOT in `cells`, on this sheet
  or on any other. Formats, notes, validation rules, merges, hidden rows and columns and defined
  names never fire an event, and neither does reading. This is NOT what you might expect.
- **One call, one event per sheet.** Every public call on a sheet or a workbook (`set`, `setMany`,
  `copy`, `fromCSV`, `fillDown`, `sort`, `replace`, `insertRows`, `undo`, `redo`, `book.undo`,
  `book.renameSheet`, `book.deleteSheet` and every other method) gives each sheet whose inputs it
  changed exactly one event, after the call has finished, listing every changed cell once, in
  row-major order whatever order the call wrote them in. A cell written and then changed back
  within one call is not listed. A call that changes no input, or writes a cell's input to what it
  already was, fires no event. So `setMany({ B1: "x", A2: "=B1" })` fires one event with
  `cells` `["B1", "A2"]`, and on a sheet holding `A1` = `1` and `A2` = `2`, `insertRows(1)` fires
  one event with `["A1", "A2", "A3"]`.
- A call that throws fires an event for any input it did change before throwing (the calls that
  check before writing change nothing, and fire nothing).
- `book.renameSheet` and `book.deleteSheet` fire an event on every sheet with an input they
  rewrote. A sheet a workbook creates by `loadWorkbook`, and a sheet made by `loadSheet`, fires no
  event for the inputs it was loaded with.

## Delivery

- Listeners are called in the order they were added, synchronously, before the call returns. The
  listeners an event goes to are the ones registered when the call that caused it finished.
- A listener may read the sheet and sees it after the change. A listener may also change the
  sheet: that change fires its own event, which is delivered only after every listener has had
  the current event.
- A sheet removed from its workbook (checkpoint 31) keeps its listeners.

## Errors

| Check | `code` | `cell` |
| --- | --- | --- |
| `listener` is a function | `#ARG` | `String(listener)` |

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
