# Checkpoint 10: precedents and dependents

## API

- `sheet.precedents(address)`: the cells this cell's formula refers to.
- `sheet.dependents(address)`: the formula cells whose formulas refer to this cell.
- Both take an optional second argument `{ transitive: true }`: then the result is every cell
  reachable by following that relation repeatedly.
- Both throw the `#ADDR` error (checkpoint 1) for an invalid address.

## Rules

- "Refers to" is the same as in checkpoint 9: every reference in the formula text counts, read or
  not. A reference to an empty cell counts. An invalid reference (one that gives `#REF!`) does not.
- A cell that is not a formula, is empty, or does not parse has no precedents.
- Any cell, including an empty one, can have dependents.
- The result is an array of upper-case addresses, each address once, in row-major order (the
  order of `cells()`).
- With `{ transitive: true }`, the cell itself is in the result only when it is on a cycle.
