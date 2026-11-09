# Checkpoint 19: dates

A date is a plain number, its **serial**: 2000-01-01 is serial 1, 2000-01-02 is 2, and so on, using
the Gregorian calendar (2000 is a leap year, 2100 is not). The last date is 9999-12-31, serial
2921940. This is NOT what Excel does (Excel counts from 1900 and treats 1900 as a leap year).

Dates have no special display: `display` shows the serial like any number.

## DATE

`DATE(year, month, day)` is the serial of that date.

- Exactly three arguments. Any other number is `#VALUE!` (`cell` = the formula cell).
- Each argument is read as in arithmetic (checkpoint 3) and truncated toward zero.
- `year` must be 2000 to 9999, `month` 1 to 12, and `day` 1 to the number of days in that month.
  Anything else is `#VALUE!` (`cell` = the formula cell). Out-of-range parts do not roll over:
  `DATE(2000, 13, 1)` and `DATE(2001, 2, 29)` are both `#VALUE!`. This is NOT what Excel does
  (Excel rolls month 13 into the next year).

## YEAR, MONTH, DAY

`YEAR(serial)`, `MONTH(serial)`, `DAY(serial)` give the parts of a date as numbers.

- Exactly one argument, read as in arithmetic and truncated toward zero.
- The serial must be 1 to 2921940, otherwise `#VALUE!` (`cell` = the formula cell). So an empty cell
  (0) is `#VALUE!`.

## Both

- A range, or a name for a range, as an argument is `#VALUE!`.
- Every argument is evaluated, and errors follow the checkpoint 4 rules.
- Date arithmetic is plain arithmetic: `DATE(2024, 3, 1) - DATE(2024, 2, 1)` is 29.
