# Checkpoint 36: performance budget

Nothing new in the API. This checkpoint sets limits on how long two workloads may take and how
deep a chain of formulas may go. Every rule of checkpoints 1 to 35 still holds, including which
cells are evaluated and how many times (checkpoints 8, 11 and 17).

## Deep chains

- A chain of formulas, each reading the one before, may be 10,000 cells long. Reading its far end
  returns the right value. It never throws, whatever order the cells were set in, and whether the
  chain stays on one sheet or crosses between sheets of a workbook (checkpoint 31).
- The same holds for an error at the bottom of a chain (it reaches the far end as checkpoint 4
  says) and for a cycle 10,000 cells long (every cell on it is `#CYCLE!`, checkpoint 9).
- Evaluation stays lazy: a deep chain behind an untaken `IF` branch is not evaluated.

## Budgets

Each is measured from the first call to the last, on the sheets described, starting from a new
sheet. The tests allow 2 seconds for the first and 3 seconds for the second.

1. **Chain read.** `Z1` holds `1`; `A1` holds `=Z1+1`; `A2` to `A9999` each hold `=` the cell
   above `+1`; `B1` holds `=A9999+1`. That is 10,000 formulas. Reading `B1` returns `10001` and
   evaluates each formula once: `stats().evaluations` is `10000`. Setting `Z1` to `2` and reading
   `B1` again returns `10002`, with exactly 10,000 more evaluations.
2. **Many small changes.** A sheet holds 10,000 formulas that do not read each other. Then 2,000
   times: set one new cell to a formula reading one of those 10,000, and read it. A change must not
   cost work in proportion to the whole sheet: finding cycles after each change by walking every
   formula on the sheet is too slow for this budget.
