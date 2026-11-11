# Checkpoint 32: dependencies across sheets

Checkpoints 9 to 12 described cycles, precedents and dependents, incremental recalculation and
`recalc()` on one sheet. In a workbook (checkpoint 31) they all cross sheets. Nothing changes for
a sheet in no workbook.

## Cycles

- A cycle may run through several sheets: `Alpha!A1` = `=Beta!B2+1` and `Beta!B2` = `=Alpha!A1+1`
  is a cycle. Every cell on it gives `#CYCLE!`, with `cell` = that cell's own address on its own
  sheet (`A1` on Alpha, `B2` on Beta). A cell that reads a cycle member and is not on the cycle
  gets that member's error, as in checkpoint 9.
- A reference to a sheet that does not exist links to nothing, so it can never close a cycle.
  When the sheet is added and closes a cycle, the cells on it give `#CYCLE!`; when it is removed
  again, they give `#REF!` or their values as before.

## Precedents and dependents

`precedents(address)` and `dependents(address)` (checkpoint 10), with or without
`{ transitive: true }`, include cells on other sheets:

- Cells on the sheet the method was called on come first, written `A1`, in row-major order.
- Then cells on other sheets, written `Name!A1` with `Name` as `sheetNames()` gives it. The sheets
  go in the order of `sheetNames()`, and each sheet's cells in row-major order.
- A sheet naming itself (`Main!A1` on `Main`) gives the plain address `A1`.
- A reference to a sheet that does not exist adds nothing to either list.
- The transitive lists follow paths through any number of sheets. The starting cell is listed
  only if a path leads back to it, as in checkpoint 10.

Example: on `Mid`, `A1` = `=Ann!B1+Zed!A2+B9+Zed!A1+A3`, where the sheets were added in the order
`Zed`, `Ann`, `Mid`. `precedents("A1")` is `["A3", "B9", "Zed!A1", "Zed!A2", "Ann!B1"]`.

## Incremental recalculation

Checkpoint 11 holds across sheets:

- After a change to a cell on one sheet, the formulas that need evaluation again are that cell (if
  it is a formula) and its transitive dependents on every sheet. No other formula on any sheet is
  evaluated again.
- Each evaluation is counted in `stats().evaluations` of the sheet that holds the formula, whichever
  sheet's read caused it.
- Adding or removing a sheet makes the formulas that name it need evaluation again, and their
  transitive dependents. No other formula is evaluated again, except on the removed sheet itself:
  every formula on it is evaluated again when next read.

## `recalc()`

`sheet.recalc()` (checkpoint 12) evaluates every formula on its own sheet that needs evaluation
and returns their addresses, plain, in the order they were evaluated. It returns cells of its own
sheet only.

- Cells on other sheets that these formulas read are evaluated when read, if they need it, and
  counted on their own sheet. They are not in the returned array. A formula on another sheet that
  nothing on this sheet reads is not evaluated.
- A cell on a cycle gets `#CYCLE!` without reading the cells it refers to. So `recalc()` never
  evaluates a cell on another sheet only because a cycle cell of this sheet refers to it: in a
  cycle `P!B1`, `Q!B1`, `P!B2`, `Q!B2`, `P.recalc()` leaves `Q`'s `evaluations` at 0.
- The order rule of checkpoint 12 applies with one change: a cell comes after every cell on its own
  sheet that it depends on, directly or through cells on other sheets. So if `A1` = `=Beta!A1`,
  `Beta!A1` = `=Main!C2` and `C2` = `=3` on `Main`, then `Main.recalc()` returns `["C2", "A1"]`.
- Cells of this sheet that depend on each other, directly or through other sheets, form one group
  as a cycle does in checkpoint 12.
