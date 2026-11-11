# Checkpoint 9: cycles

A formula that depends on itself, directly (`A1` holding `=A1+1`) or through other cells
(`A1` = `=B1`, `B1` = `=A1`), is on a cycle.

## What counts as a dependency

A cell depends on every cell its formula text refers to, whether or not evaluation would actually
read it. Later checkpoints add more ways to refer to cells (ranges, names); every one of them
counts. Only formula cells can be on a cycle.

## Values

- Every cell on a cycle evaluates to the error `#CYCLE!`, whatever else its formula would give.
  Its `cell` is that cell's own address: in the two-cell example, `A1` gives `#CYCLE!` with `cell`
  `A1` and `B1` gives `#CYCLE!` with `cell` `B1`. Its `message` is exactly `circular reference`.
  This is NOT what Excel does (Excel shows 0 and a warning).
- A cell that is not on a cycle but reads a cycle cell gets that error by the normal propagation
  rules (checkpoint 4): same `code`, same `cell` (the cycle cell it came from).
- `#CYCLE!` has the highest priority of all errors:
  `#CYCLE!` > `#REF!` > `#NAME?` > `#VALUE!` > `#DIV/0!`.
- Producing `#CYCLE!` for a cell counts as one evaluation in `stats().evaluations`.
- When an edit breaks the cycle, the cells compute normal values again.
