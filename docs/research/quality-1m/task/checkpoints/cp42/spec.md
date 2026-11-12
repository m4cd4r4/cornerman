# Checkpoint 42: cell notes

A cell can now carry a note: a short text for people, never read by formulas. A note belongs to
the cell's place on the sheet, not to its input.

## API

- `sheet.setNote(address, text)`: sets the note of one cell. Returns `undefined`.
- `sheet.getNote(address)`: the cell's note, or `null` when it has none.
- `sheet.notes()`: a plain object, address (upper case) -> note, for every cell with a note, with
  its keys in row-major order (checkpoint 10). `{}` when there are none.

## The text

- The text is trimmed of leading and trailing white space (as JavaScript's `trim()` does) before
  it is stored, and `getNote` gives the trimmed text. A text that is empty after trimming removes
  the note. This is NOT what you might expect (the text is not kept exactly as given, and `"  "`
  does not make a note).
- After trimming, a note holds at most 200 characters.
- Setting the note a cell already has changes nothing.

## Notes and inputs

- A note does not make a cell non-empty: `get`, `display`, `cells()`, `toCSV`, `precedents` and
  every formula behave as if there were no notes.
- `set` and `fromCSV` never change a note. Clearing a cell's input keeps its note.
- `copy` (checkpoint 26) does not copy notes: the target cells keep the notes they had, and the
  source cells keep theirs. This is NOT what Excel does (Excel pastes notes with the cells).
- Insert and delete (checkpoints 23-25) move a note with its cell. A note in a deleted row or
  column is gone. A note that an insert would push past the last row or column is dropped, without
  an error; only inputs make an insert throw `#FULL`. This is NOT what you might expect.
- Undo (checkpoint 27): each `setNote` that changes a note is one undo step. Undo and redo of an
  insert or delete put the notes back where they were.
- `book.renameSheet` (checkpoint 37) does not change any note. Notes are per sheet.

## Saving

- `save()` (checkpoint 30, cells and names as it writes them) writes a `notes` object after `names` when the sheet has at least one
  note: address -> text, in row-major order. A sheet with no notes writes no `notes` key, so its
  save text is exactly what it was before this checkpoint.
- `book.save()` (checkpoint 35) writes the same `notes` object, under the same rule, in each sheet
  entry after its `names`.
- `loadSheet` and `loadWorkbook` read `notes` when it is there and give each sheet its notes. A
  missing `notes` key means no notes. A version 1 sheet migrated by `loadWorkbook` keeps its notes.
- When `notes` is there, it is checked after `names`, and the load throws `#LOAD` at the first
  failure:

| Check | `cell` in a sheet save | `cell` in a workbook save |
| --- | --- | --- |
| `notes` is a plain object | `notes` | `sheets.N.notes` |
| each key is an upper-case cell address | the key | `sheets.N.notes.KEY` |
| each value is text `setNote` would store as it is: a string, non-empty, already trimmed, at most 200 characters | the key | `sheets.N.notes.KEY` |

## Errors

`setNote` checks, in this order, and throws at the first failure, changing nothing:

| Check | `code` | `cell` |
| --- | --- | --- |
| `address` is valid | `#ADDR` | as `get` does (checkpoint 1) |
| `text` is a string | `#NOTE` | the address, upper case |
| the trimmed text is at most 200 characters | `#NOTE` | the address, upper case |

`getNote` throws for an invalid address as `get` does.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
