# Checkpoint 24: delete rows

## API

- `sheet.deleteRows(at, count = 1)`: deletes rows `at` to `at + count - 1`. Their cells are gone.
  Every cell below them moves up by `count` rows, keeping its input.
- The arguments follow the same rules as `insertRows` (checkpoint 23); bad ones throw
  `{ code: "#ARG", cell: String(at), message }` and change nothing.

## Formula text

Every formula's text is rewritten so it still points at the same cells, with the same rules for
what is left as typed and what is written in upper case as in checkpoint 23.

- A reference into a deleted row becomes `#REF!`.
- A reference below the deleted rows moves up by `count`. A reference above them stays.
- A range with every row deleted becomes `#REF!` (the whole range, both corners and the `:`).
- A range with only some rows deleted shrinks to the rows that are left: a top corner inside the
  deleted rows moves to row `at`, a bottom corner inside them moves to row `at - 1`, and a corner
  below them moves up by `count`. Deleting row 3 from `A2:A5` gives `A2:A4`; deleting rows 1-2
  gives `A1:A3`; deleting rows 4-6 gives `A2:A3`.
- "Top" and "bottom" mean the range's real top and bottom rows, whichever corner was written first.

## Names and recalculation

- Defined names move and shrink by the same rules. A name whose target is wholly deleted is
  removed. This is NOT what Excel does (Excel keeps the name, pointing at `#REF!`).
- After `deleteRows`, every formula in the sheet needs evaluation again (checkpoints 8 and 11), and
  precedents, dependents and cycles follow the new text.
