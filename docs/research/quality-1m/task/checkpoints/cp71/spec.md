# Checkpoint 71: protected cells

A cell can now be protected. Writes that would change a protected cell's input are refused.

## API

- `sheet.protect(target)`: protects every cell of `target`. `target` is one address or a range, as
  for `setFormat` (checkpoint 41). Protecting a protected cell changes nothing. Returns `undefined`.
- `sheet.unprotect(target)`: removes the protection from every cell of `target`. Returns
  `undefined`.
- `sheet.isProtected(address)`: `true` or `false`. Throws for an invalid address as `get` does.
- `sheet.protectedCells()`: the protected addresses, upper case, row-major. `[]` when none.

Protection belongs to the cell, whether or not it holds an input; an empty protected cell refuses
an input too.

## What is refused

A write is refused only when it would **change** the input of a protected cell. Writing a protected
cell's own input to it again (`set("A1", "1")` when `A1` already holds `1`, or a copy or fill that
writes the same text) is allowed and changes nothing. This is NOT what you might expect. A refused
write throws `#LOCKED` with `cell` = the address in upper case, and the call writes nothing at all.

- `set`, `setCell`, `setMany`, `fromCSV`, `fillDown`, `fillRight` and `replace` check every input
  they would write before writing any, cell by cell in their order (as checkpoints 46, 64 and 67
  say). For each cell: a merge (`#MERGE`) first, then protection (`#LOCKED`), then the formula
  limits (`#LIMIT`), then its validation rule (`#INVALID`).
- `copy` (checkpoint 26), `book.copy` (checkpoint 68) and `sort` (checkpoint 48), which check no
  rules and no limits, check protection: every target cell in row-major order, before writing any.
  Their other checks (address, size, sheet edge, `#MERGE` for `sort`) come first, as before.

## What is not refused

- **Undo and redo** (checkpoints 27 and 55) never check protection. `protect` and `unprotect` are
  not undo steps and do not clear any redo. So after `set("A1", "1")`, `protect("A1")`, `undo()`,
  the cell is empty and still protected. This is NOT what you might expect.
- **Insert and delete** of rows and columns are allowed on a sheet with protected cells. Protection
  moves with its cell as a number format does (checkpoint 41), protection in a deleted row or
  column is gone, inserted cells are not protected, and formulas in protected cells are rewritten as
  any other. This is NOT what Excel does (on a protected sheet, Excel refuses to insert or delete
  rows). Undoing an insert or a delete puts every cell's protection back as it was just before that
  insert or delete, including protection changed since.
- `book.renameSheet` and `book.deleteSheet` rewrite formulas in protected cells. A batch that rolls
  back (checkpoint 66) puts inputs and protection back as they were.
- Formats, notes, validation rules, merges and hidden rows and columns can be set on protected
  cells. `copy`, `book.copy`, `sort` and fills neither carry nor change protection: it stays with
  the cell.

## Other changes

- Protection is not saved: `save()` and `book.save()` write no trace of it (a sheet whose only
  extra is protection still saves as version 2, checkpoint 56), and a loaded sheet has none.
- Protecting and unprotecting fire no change event (checkpoint 65).

## Errors

`protect` and `unprotect` check `target` as `setFormat` does: `#ADDR` (`cell` = `String(target)`)
for a target that is not an address or a range, then `#ARG` (`cell` = `target`) for more than
10,000 cells.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
