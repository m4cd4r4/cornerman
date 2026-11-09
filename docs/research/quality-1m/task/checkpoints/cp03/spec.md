# Checkpoint 3: cell references

Formulas can refer to other cells: `=A1+B2*2`.

- A reference is one or two letters followed by digits, case-insensitive.
- A reference whose address is invalid (for example `A0`, `B01`, `C10000`) evaluates to `#REF!`
  with `cell` = the formula cell. Three or more letters followed by digits (`ABC1`) is `#PARSE!`.
- An empty cell reads as `0` in arithmetic.
- A formula's result is never empty: a formula that is only a reference to an empty cell
  (`=Q7`) gives `0`.
- A text cell used in arithmetic gives `#VALUE!` with `cell` = the formula cell doing the
  arithmetic.
- `get` always reflects the current inputs: after `set("A1", "5")`, a formula reading `A1` returns
  a value computed from 5.
