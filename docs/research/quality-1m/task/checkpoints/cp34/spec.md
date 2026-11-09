# Checkpoint 34: optional reading-order errors

Checkpoint 4 (and checkpoints 9 and 21, which added codes) pick the error that wins when several
meet by a priority list, then by cell. This checkpoint adds a second rule that a sheet or a
workbook can choose. The priority list stays the default, so nothing changes unless it is asked
for.

## The option

- `createSheet(options)`, `loadSheet(text, options)` and `createWorkbook(options)` take an optional
  object. Its key `errorOrder` is `"priority"` (the default, as before) or `"first"`.
- `options` may be left out, and an object without `errorOrder` means `"priority"`.
- Options are checked before anything else, so `loadSheet` checks them before the text. These
  throw `{ code: "#ARG", cell, message }`:

| Problem | `cell` |
| --- | --- |
| `options` is given but is not an object (including `null` and arrays) | `""` |
| `errorOrder` is any value other than the two above | `String(errorOrder)` |

- All sheets of a workbook use the workbook's order, including a sheet after it is removed. A
  saved sheet does not record its order: `loadSheet` uses the order passed to it.

## `"first"`

Where several errors meet in one step, the one met first in reading order wins, whatever its code
and cell:

- an operator: the left operand before the right (`=A1+B1` takes A1's error if both are errors);
- a function: its arguments left to right;
- a range: its cells in row-major order.

Everything else is unchanged. In particular a cell on a cycle is `#CYCLE!` (checkpoint 9), a
function that stops at its first error still stops there, and a cell that reads only one error
gets that error.

Example: A1 = `=1/0`, B1 = `=nope`. With `"priority"`, `=A1+B1` and `=B1+A1` both give B1's
`#NAME?`. With `"first"`, `=A1+B1` gives A1's `#DIV/0!` and `=B1+A1` gives B1's `#NAME?`.
