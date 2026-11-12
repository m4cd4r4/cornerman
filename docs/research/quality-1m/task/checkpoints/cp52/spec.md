# Checkpoint 52: named constants

A defined name (checkpoint 14) can now stand for a value instead of cells.

## API

- `sheet.defineConstant(name, value)`: defines `name` as the constant `value`. Returns
  `undefined`. `value` is a finite number, a string or a boolean, used exactly as given: `-0` is
  stored as `0`, and nothing else is converted.

## One namespace

- Constants and the names of checkpoint 14 are one set of names. `defineConstant` replaces a name
  for cells with the same name (in any case), and `defineName` replaces a constant. `removeName`
  removes either kind.
- `names()` lists constants with the others, in the same sorted order (checkpoint 14). A constant is written as
  `=` followed by its value: a number as JavaScript's `String(n)` gives it (`"=0.25"`, `"=-3"`,
  `"=1e+21"`), a string in double quotes with each `"` inside written twice (`'="a ""b"""'`), a
  boolean as `"=TRUE"` or `"=FALSE"`.
- Defining a name as exactly the constant it already has (same type, same value) changes nothing.

## In formulas

- A constant used as a value in a formula gives its value, with the type it was given. A string
  stays a string even when it looks like a number: after `defineConstant("CODE", "5")`, `=CODE+1`
  is `#VALUE!` and `=CODE&"x"` is `"5x"`. This is NOT what you might expect (typing `5` into a
  cell gives a number).
- As a function argument, a name is always a range argument (checkpoint 14). A constant there is
  `#VALUE!` (`cell` = the formula cell) for every function that takes a range argument: `SUM(RATE)`,
  `COUNT(RATE)`, `AND(FLAG)`, `SUMPRODUCT(RATE)` and the range of `SUMIF(RATE, ...)` are all
  `#VALUE!`. This is NOT what Excel does (Excel gives `SUM(RATE)` = the constant). Where a function
  takes a value, the constant is a value: `ROUND(RATE, 1)`, `IF(FLAG, 1, 2)` and `RATE*2` use it.
- A constant reads no cells: a formula that uses it has no precedent for it (checkpoints 10 and
  39), and it is never part of a cycle. Defining, redefining or removing a constant makes the
  formulas that use it give their new values, and no other formula is evaluated again.

## Constants and other changes

- Undo (checkpoint 27): each `defineConstant` that changes something is one undo step, as
  `defineName` is.
- Insert and delete rows and columns never change or remove a constant. Copy, sort, find and
  replace, and `renameSheet` never change one.
- `save()` (checkpoint 30) and `book.save()` (checkpoint 35) write constants in `names`, exactly as
  `names()` writes them. `loadSheet` and `loadWorkbook` accept a target that starts with `=` when
  it is a constant written exactly that way; any other target that starts with `=` fails the
  checkpoint 30 check on its key (`#LOAD`, `cell` = the key, or `sheets.N.names.KEY`). A save with
  no constants is exactly what it was before this checkpoint.

## Errors

`defineConstant` checks, in this order, and throws at the first failure, changing nothing:

| Check | `code` | `cell` |
| --- | --- | --- |
| `name` is a valid name (checkpoint 14) | `#BADNAME` | `String(name)` |
| `value` is a finite number, a string or a boolean | `#ARG` | `String(value)` |

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
