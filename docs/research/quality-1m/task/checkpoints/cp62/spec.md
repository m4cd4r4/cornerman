# Checkpoint 62: LET

`LET(name1, value1, name2, value2, ..., calculation)` gives names to values inside one formula, then
gives the value of `calculation`, where the names can be used. `LET(x, 2, y, x + 1, x * y)` is 6.

## The arguments

- The arguments are one or more pairs of a name and a value, then the calculation: an odd number,
  at least three. Anything else is `#VALUE!` (`cell` = the formula cell).
- Each name must be written as a plain name: a word that follows the name rule of checkpoint 14.
  A string (`"x"`), a reference (`A1`, `ab12`), `TRUE`, or any expression is `#VALUE!` (`cell` = the
  formula cell). A word of three or more letters followed by digits (`abc12`) does not parse at
  all, so the formula is `#PARSE!` as before (checkpoint 2).
- Names ignore case, as defined names do: `LET(x, 1, X + 1)` is 2. The same name twice in one `LET`
  (in any case) is `#VALUE!` (`cell` = the formula cell).
- These checks come before anything is evaluated.

## Evaluation

- Every value is evaluated, once, in order, before the calculation, even a value the calculation
  never uses.
- A value can use the names of the pairs before it. Inside its own value, a name is not yet
  defined: there it means what it means outside the `LET`. With a sheet constant `X` of 5,
  `LET(x, x + 1, x)` is 6; with no `X` it is `#NAME?`.
- An error in a value is not by itself the result: `LET(x, 1/0, 5)` is 5. Where the name is used,
  it gives that error, exactly as its value gave it (same code, same `cell`).
- A `LET` inside another can use the outer names and can define the same names again; the inner
  ones win inside it: `LET(x, 1, LET(x, x + 1, x) + x)` is 3.

## A LET name is a value

- A name holds the value its expression gave. A reference to an empty cell gives an empty value,
  which behaves as an empty cell does: with `A1` empty, `LET(v, A1, v + 1)` is 1 and
  `LET(v, A1, v & "a")` is `"a"`.
- A name never holds a range. A range as a value is `#VALUE!` (checkpoint 13), and as a function
  argument a `LET` name is `#VALUE!` (`cell` = the formula cell) wherever a range argument is
  taken, exactly as a named constant is (checkpoint 52): `LET(r, A1:A3, SUM(r))` and
  `LET(x, 5, SUM(x))` are both `#VALUE!`, and so is `LET(x, A1, COUNT(x))`. This is NOT what Excel
  does (Excel's LET can hold a range, and `SUM(x)` there is 5).

## LET names and defined names

- Inside a `LET`, its names hide a sheet's own names, workbook names and constants (checkpoints 14,
  52 and 53) of the same name, in values after their own and in the calculation, also inside
  nested function calls. Outside the `LET`, in the rest of the formula, the defined name is used
  as before: with a sheet name `TAX` for a cell holding 10, `LET(tax, 2, tax * 3) + TAX` is 16.
- A `LET` name is not a defined name: `names()` does not list it, and it never reaches another
  formula.
- Where a `LET` name hides a defined name, that defined name is not used: its cells are not
  precedents of the formula (checkpoints 10 and 53), and defining, changing or removing it makes the
  formula evaluate nothing again. Where the defined name is used (outside the `LET`, or inside the
  hiding name's own value), it works as before. This is NOT what you might expect.
- References in every value and in the calculation are precedents, whether or not the name is
  used.

## How it meets earlier checkpoints

- Insert, delete and copy move the references in a `LET` and never change its names. Rename and
  delete of a sheet (checkpoints 37 and 54) rewrite the references as usual, and a `LET` name equal
  to a sheet name is not a sheet reference: in `LET(data, 2, Data!A1 * data)`, `Data!A1` is the
  cell and `data` the name.
- `canonical` (checkpoint 38) writes `LET` names in upper case like any name.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
