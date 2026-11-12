# Checkpoint 50: SUBTOTAL

`SUBTOTAL(code, range, ...)` works out an aggregate over its ranges, leaving out the cells
in hidden rows (checkpoint 49) and the cells that hold a SUBTOTAL of their own, so that subtotals
inside a range are not counted twice.

## The code

- The code table follows what we agreed when the aggregate functions were built.
- `code` is read as a number as arithmetic reads it (an empty cell is 0, a boolean 1 or 0, text is
  `#VALUE!`) and truncated toward zero, so `1.9` is `1`.

## Arguments

- Two or more arguments: the code, then one or more ranges. Fewer is `#VALUE!`.
- Every argument after the code must be a range argument (a bare range, a bare reference, or a
  name, as in checkpoint 13). Any other expression is `#VALUE!`, even one that would give a number:
  `SUBTOTAL(9, 5)` and `SUBTOTAL(9, A1+1)` are `#VALUE!`. This is NOT what you might expect.
- Checked in this order, the first failure being the result: the number of arguments; the code (an
  error in it is the result as it is); the code's value; range arguments only. Then each range is
  read: a bad range or a missing sheet (checkpoints 13 and 31) and the error values of the cells
  that are counted are collected, and if any were collected the winner by the checkpoint 4 rules
  (or checkpoint 34, on a sheet using `"first"`) is the result.

## Which cells count

- A cell in a hidden row is left out, whatever the code. This is NOT what Excel does.
- Hidden columns are never left out.
- A cell is left out when its formula's outermost operation is a SUBTOTAL call:
  `=SUBTOTAL(9, A1:A3)` and `=(subtotal(9, A1:A3))` are left out, but `=SUBTOTAL(9, A1:A3)*2`,
  `=-SUBTOTAL(9, A1:A3)` and `=IF(TRUE, SUBTOTAL(9, A1:A3))` are counted like any other cell. This
  is NOT what Excel does (Excel leaves out every cell whose formula contains SUBTOTAL anywhere). A
  formula that does not parse is never left out.
- For a range on another sheet (`Data!A1:A9`, checkpoint 31), the hidden rows and formulas of that sheet decide.
- A cell left out is not read at all, so its error value is not collected. The other cells count
  as the aggregate in checkpoint 15 counts range cells: numbers only; text, booleans and empty
  cells are skipped; error values are collected, except by COUNT, which ignores them. With no
  numbers, AVERAGE is `#DIV/0!` and MAX and MIN are `#VALUE!`, SUM is 0 and COUNT is 0.
- A covered cell of a merge (checkpoint 47) reads as empty, so it never counts.

## SUBTOTAL and other changes

- Every cell of every range is a precedent of the formula (checkpoints 9 and 10), counted or not.
  So a SUBTOTAL whose range holds its own cell is on a cycle and gives `#CYCLE!` (checkpoint 9),
  even though it would leave itself out.
- Hiding or showing a row, through `hideRows`, `showRows`, undo or redo, changes what SUBTOTAL
  formulas give: a SUBTOTAL formula that reads a sheet whose hidden rows changed gives the new
  result the next time it is read, on that sheet or any other sheet of the workbook. How many
  cells are evaluated again is not specified.
- Insert and delete rows and columns, copy, `canonical` and `explain` treat SUBTOTAL like any
  other function. The code is an ordinary argument: copy and insert never change it.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
