# Checkpoint 74: performance budget for wide fan-out

Nothing new in the API. Checkpoint 36 set budgets for long chains; this checkpoint sets budgets for
the opposite shape: one cell read by very many formulas, and layers of formulas that each read the
whole layer before. Every rule of checkpoints 1 to 73 still holds, including which cells are
evaluated and how many times (checkpoints 8, 11 and 17).

## Which cells are evaluated again

- After a change to a cell, every formula that reads it, directly or through other formulas, a
  range, a defined name or another sheet, is evaluated again when it is next read, once (checkpoint
  11). Nothing else is.
- There is no early cut-off. A formula evaluated again that gives the same value as before still
  makes every formula reading it be evaluated again when read: with `B1` = `=A1*0` and 1,000
  formulas reading `B1`, changing `A1` evaluates `B1` and all 1,000 again, although `B1` stays `0`.
  The same holds for an input changed to a different text with the same value (`1` to `1.0`). This
  is NOT what you might expect.
- Dependencies are the references written in the formula (checkpoint 17), so a formula reading
  `A1` only in an `IF` branch it does not take, such as `=IF(FALSE, A1, 0)`, is a dependent of `A1`
  and is evaluated again after `A1` changes. This is NOT what you might expect.
- Setting a cell to the input it already holds still changes nothing, however many formulas read
  it (checkpoint 11). `undo` and `redo` of a change are changes like any other.

## Budgets

Each is measured from the first call to the last, on the sheets described, starting from a new
sheet, after every formula has been read once. The tests allow the times given.

1. **Wide fan-out.** `A1` holds `1`. `B1` to `B9999` and `C1` each hold `=$A$1+n`, where `n` is
   the cell's row (`C1` holds `=$A$1+1`): 10,000 formulas reading `A1`. Setting `A1` to `2` and then
   reading all 10,000 takes at most 1 second, gives the new values, and evaluates exactly 10,000
   formulas. `dependents("A1")` (checkpoint 10) returns the 10,000 addresses in row-major order
   (`B1`, `C1`, `B2`, `B3`, ...) in at most 1 second.
2. **Layers.** `A1` holds `1`. Four columns `B` to `E` hold 60 formulas each, in rows 1 to 60:
   `B` + row `r` holds `=$A$1+r`, and every later column holds `=SUM(X$1:X$60)+r`, where `X` is the
   column before it. Setting `A1` to `2` and then reading all 60 cells of column `E` takes at most 1
   second and evaluates exactly 240 formulas. Every cell in columns `C` to `E` is reached through
   60 paths or more, so work that follows each path separately instead of each cell once is far
   too slow.
3. **Changes beside a fan-out.** On the sheet of budget 1, 2,000 times: set a cell that no formula
   reads (`E1`, `E2`, ...) to a number, then read one of the 10,000 formulas. All 2,000 pairs take at
   most 1 second and evaluate nothing. A change must not cost work in proportion to the sheet: no
   evaluating, sorting or walking every formula after each change.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
