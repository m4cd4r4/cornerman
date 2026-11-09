# Checkpoint 33: API version 2

Version 2 adds new method names. Every version 1 name keeps working exactly as before: the new
names are added beside them, and code written against checkpoints 1 to 32 does not change.

## Sheet methods

| New name | Same as | Difference |
| --- | --- | --- |
| `setCell(address, input)` | `set` | none |
| `value(address)` | `get` | none |
| `text(address)` | `display` | none |
| `addresses()` | `cells()` | none |
| `formula(address)` | `getInput` | an empty cell gives `""`, not `null` |
| `setMany(cells)` | (new) | see below |

Every sheet has these methods: sheets from `createSheet()`, `loadSheet()` and `addSheet()`.
They throw the same errors as the methods they stand for (an invalid address is `#ADDR` with
`cell` = the address as given).

## `setMany(cells)`

- `cells` is a plain object mapping addresses to inputs, such as `{ A1: "2", B1: "=A1*3" }`. The
  writes are made in the order of the object's keys, and they are one undo step (checkpoint 27):
  one `undo()` takes all of them back. Cells whose input does not change are not recorded; if
  none changes, nothing is recorded.
- Two keys may name the same cell (`a1` and `A1`); the one later in the object wins.
- Every address is checked before anything is written. If any is invalid, `setMany` throws `#ADDR`
  for the first invalid one in key order, and no cell changes.
- If `cells` is not an object, or is `null` or an array, it throws `{ code: "#ARG", cell: "" }`.

## Workbook

`book.get(name)` is the same as `book.sheet(name)`.
