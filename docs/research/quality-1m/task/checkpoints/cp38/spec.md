# Checkpoint 38: canonical formula text

A sheet can now give a cell's formula in one standard written form, printed from the formula's
parse rather than from what was typed.

## API

- `sheet.canonical(address)`: returns a string. An invalid address throws as `getInput` does
  (checkpoint 1).

## Which text

- An empty cell gives `""`.
- An input that is not a formula (it does not start with `=`) is returned exactly as typed.
- A formula that does not parse is returned exactly as typed, `=` included.
- Any other formula gives `=` followed by its printed form, below.

`canonical` evaluates nothing, changes nothing and is not recorded for undo.

## The printed form

- No spaces anywhere outside string literals.
- Function names, defined names, cell references, sheet prefixes (checkpoint 31), `TRUE` and
  `FALSE` are in upper case. `$` marks (checkpoint 26) are kept where they were typed.
- A range on another sheet is written with one prefix: `DATA!A1:B2`.
- A cell reference that is off the sheet is written in upper case as it was typed (`=a0` gives
  `=A0`); `#REF!` is written `#REF!`.
- A number is written with the digits as typed, less any leading zeros before the first digit of
  the whole part (one `0` stays) and any trailing zeros after the `.`, and the `.` itself when
  nothing is left after it. `007.50` gives `7.5`, `0.0` gives `0`, and `1000000000000000000000` stays as it is.
- A string literal is written in double quotes with its text exactly as typed, a `"` inside it
  written as `""`.
- Function arguments are separated by `,` alone. `SUM()` stays `SUM()`.
- Unary `-` and `+` are both kept: `=+1` gives `=+1`, `=--1` gives `=--1`.

## Parentheses

The printed form has a pair of parentheses only where leaving it out would parse to a different
formula. Precedence, from lowest: comparisons, then `&`, then `+` and `-`, then `*` and `/`, then
unary `-` and `+`, then `^`, then postfix `%` (checkpoints 2, 6, 7).

- Comparisons, `&`, `+ -` and `* /` group to the left: `=(1-2)-3` gives `=1-2-3`, while `=1-(2-3)`
  keeps its parentheses. The same holds for `=1<2=TRUE` against `=1<(2=TRUE)`.
- `^` groups to the right: `=2^3^2` stays as is, `=(2^3)^2` keeps its parentheses.
- Unary minus is below `^`: `=-2^2` stays as is, `=(-2)^2` keeps its parentheses, and `=-(2^2)`
  gives `=-2^2`. A unary operator may follow a binary one: `=2*-3` and `=1--1` need none.
- `=(((1)))` gives `=1`; `=(1+2)%` keeps its parentheses.

## The guarantee

For every formula that parses, setting a cell to `canonical`'s text gives the same value as the
original (with the same `cell` in any error, when it is set at the same address), and `canonical`
of that cell returns the same text again.
