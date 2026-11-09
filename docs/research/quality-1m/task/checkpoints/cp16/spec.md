# Checkpoint 16: ROUND, ROUNDUP, ROUNDDOWN

`ROUND(x, digits)`, `ROUNDUP(x, digits)`, `ROUNDDOWN(x, digits)`.

## Arguments

- Exactly two arguments. Any other number of arguments is `#VALUE!` (`cell` = the formula cell).
- Both are values, read as in arithmetic (checkpoint 3): a reference reads its cell, an empty cell
  is 0, a boolean is 1 or 0, text is `#VALUE!`. A range, or a name for a range, is `#VALUE!`.
- `digits` is truncated toward zero (`1.9` is `1`, `-1.9` is `-1`). After truncation it must be
  from -15 to 15, otherwise `#VALUE!`.
- Negative `digits` rounds to the left of the decimal point: `ROUND(1234.5678, -2)` is 1200.
- Errors in the arguments follow the checkpoint 4 rules.

## Rounding

- The decision uses the number's shortest decimal form, the digits `String(x)` gives (as in
  checkpoint 5), not its binary value. So `0.1+0.2` is rounded as `0.30000000000000004`.
- `ROUND`: half to even ("banker's rounding"), like `display`. `ROUND(2.5, 0)` is 2,
  `ROUND(3.5, 0)` is 4, `ROUND(-2.5, 0)` is -2, `ROUND(25, -1)` is 20. This is NOT what Excel does
  (Excel rounds half away from zero).
- `ROUNDUP`: away from zero whenever any discarded digit is not zero. `ROUNDUP(-1.01, 0)` is -2,
  and `ROUNDUP(0.1+0.2, 1)` is 0.4.
- `ROUNDDOWN`: toward zero. `ROUNDDOWN(-1.99, 0)` is -1.
- A result of zero is `0`, never `-0`.
