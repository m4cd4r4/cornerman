# Checkpoint 12: recalculation order log

## API

`sheet.recalc()` evaluates every formula cell that needs evaluation (changed since it was last
evaluated, or never evaluated) and returns the array of their addresses in the order they were
evaluated. If nothing needs evaluation it returns `[]`. Each returned cell was evaluated exactly
once, and reading any formula cell right after `recalc()` evaluates nothing.

## Order

- A cell comes after every cell it depends on that is also in this recalculation.
- Among the cells that are free to go next, the one first in row-major order goes first. Choose
  again after every cell.

  Example: `A1` = `=C1`, `B1` = `=1`, `C1` = `=1`. The order is `B1`, `C1`, `A1`: at the start
  `B1` and `C1` are free and `B1` is first in row-major order; `A1` must wait for `C1`.
- The cells of one cycle (checkpoint 9) go together as one group, in row-major order inside the
  group. The group is free when every cell it depends on outside the group is done, and it takes
  its place among the free cells by its row-major-first member.
- A formula that does not parse is free at once.

## Coming later

- When change listeners arrive (`sheet.onChange(listener)`), a listener that throws is ignored: the
  change stays, the other listeners are still called, and the call that caused the event returns
  normally.
