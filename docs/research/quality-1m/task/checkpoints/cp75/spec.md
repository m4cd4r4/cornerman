# Checkpoint 75: API v3 and deprecations

Version 3 of the API adds two sheet methods and starts to retire the version 1 names that
checkpoint 33 kept as aliases. The old names still work exactly as before; each sheet and each
workbook now keeps a log of the calls made to them.

## New methods

- `sheet.cell(address)`: a new object `{ address, input, value, text }` for one cell. `address`
  is upper case; `input` is what `formula` gives (`""` for an empty cell, checkpoint 33); `value`
  is what `value` gives and `text` what `text` gives (number formats, decimal comma and all). It
  evaluates exactly as `value` would, and an invalid address throws `#ADDR` as `value` does.
- `sheet.clear(target)`: removes the input of every cell in `target` that holds one, as one undo
  step, and returns how many cells it cleared (`0` when none held an input, and then there is no
  undo step). `target` is a cell or a range, checked as `setFormat` checks it (checkpoint 41):
  `#ADDR` (`cell` = `String(target)`), then `#ARG` for more than 10,000 cells.
  - It removes inputs only. Number formats, notes, validation rules, merges, hidden rows and
    columns and protection stay as they were. This is NOT what Excel's Clear All does.
  - A covered cell of a merge (checkpoint 47) is skipped: its hidden input stays, so `unmerge`
    after `clear` brings it back, and it is not counted. This is NOT what you might expect.
  - Validation rules never refuse it (clearing always passes, checkpoint 46). A protected cell
    (checkpoint 71) that holds an input refuses: `#LOCKED`, `cell` = that cell, the first such cell
    row-major, and nothing is cleared. A protected cell that is already empty is fine.
  - It fires one change event for the cells it cleared (checkpoint 65).

## Deprecated names

| Deprecated | Use instead |
| --- | --- |
| `sheet.set` | `setCell` |
| `sheet.get` | `value` |
| `sheet.display` | `text` |
| `sheet.cells` | `addresses` |
| `sheet.getInput` | `formula` |
| `book.sheet` | `get` |

The version 2 names (`setCell`, `value`, `text`, `addresses`, `formula`, `setMany`, `book.get`)
and every other method are current, not deprecated.

## The deprecation log

- `sheet.deprecations()` returns an array with one object `{ name, use, calls }` for each
  deprecated sheet name called on that sheet, in the order each was first called: `name` as in the
  table (`"getInput"`), `use` its replacement (`"formula"`), and `calls` how many calls were made.
  `[]` when there were none. `book.deprecations()` does the same for `book.sheet` on that workbook.
  Each call returns new objects; changing them changes nothing.
- Every call you make to a deprecated name counts once, also a call that throws: `get("A0")`
  throws `#ADDR` and still counts. This is NOT what you might expect.
- Calls the library makes for you never count. Calling `setCell`, `value`, `text`, `addresses`,
  `formula`, `cell`, `book.get` or any other method adds nothing to any log, even where it does
  exactly what a deprecated name does. This is NOT what you might expect if a new name is written
  as a call of an old one.
- Calls your own code makes count wherever they are made: in a change listener (checkpoint 65), or
  inside the function given to `book.batch` (checkpoint 66).
- The log is not part of the sheet's content. It is not an undo step and `undo` does not change it;
  `save` does not write it and a loaded sheet starts with an empty log; a sheet removed from a
  workbook keeps its log; and a batch that rolls back does not take calls out of it (calls made
  before the throw stay counted). This is NOT what you might expect.
- Each sheet has its own log, also the sheets of one workbook; `book.deprecations()` holds only
  `book.sheet` calls.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
