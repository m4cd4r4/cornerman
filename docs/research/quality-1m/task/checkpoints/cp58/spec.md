# Checkpoint 58: EDATE, EOMONTH and WEEKDAY

Three functions on the date serials of checkpoint 19 (2000-01-01 is serial 1, 9999-12-31 is serial
2921940). Serial 1, 2000-01-01, was a Saturday.

## EDATE and EOMONTH

`EDATE(start, months)` is the serial of the date `months` months after `start` (before it when
`months` is negative). `EOMONTH(start, months)` is the serial of the last day of the month that is
`months` months after the month of `start`.

- Exactly two arguments each. Any other number is `#VALUE!` (`cell` = the formula cell).
- `start` is read as in arithmetic (checkpoint 3) and truncated toward zero, as in checkpoint 19.
  It must then be 1 to 2921940, otherwise `#VALUE!` (`cell` = the formula cell).
- `months` is read as in arithmetic and must then be a whole number. A fraction is `#VALUE!`
  (`cell` = the formula cell): `EDATE(x, 1.5)` and `EDATE(x, -0.5)` are both `#VALUE!`. This is
  NOT what Excel does (Excel truncates `months`, so 1.5 is 1). An empty cell is 0 months, and
  `TRUE` is 1.
- `EDATE` keeps the day of the month. When the target month is shorter, it gives that month's last
  day: `EDATE(DATE(2000, 1, 31), 1)` is `DATE(2000, 2, 29)`. Nothing rolls over into the next
  month, unlike what `DATE` refuses outright (checkpoint 19: `DATE(2000, 2, 30)` is `#VALUE!`).
- A `start` on the last day of its month does not stay on last days: `EDATE(DATE(2000, 2, 29), 1)`
  is `DATE(2000, 3, 29)`, not March 31. This is NOT what you might expect. Use `EOMONTH` for last
  days: `EOMONTH(DATE(2000, 2, 10), 0)` is `DATE(2000, 2, 29)`.
- A result before 2000-01-01 or after 9999-12-31 is `#VALUE!` (`cell` = the formula cell).

## WEEKDAY

`WEEKDAY(serial)` or `WEEKDAY(serial, type)`: the day of the week of a serial, as a number.

- One or two arguments. Any other number is `#VALUE!` (`cell` = the formula cell).
- `serial` is read and checked as `start` is above (truncated, then 1 to 2921940).
- `type` is read as in arithmetic and must then be exactly 1, 2 or 3, otherwise `#VALUE!` (`cell` =
  the formula cell). It is not truncated: `1.5` is `#VALUE!`, and so is an empty cell (0).

| `type` | Monday | Tuesday | ... | Saturday | Sunday |
| --- | --- | --- | --- | --- | --- |
| 1 | 2 | 3 | ... | 7 | 1 |
| 2 | 1 | 2 | ... | 6 | 7 |
| 3 | 0 | 1 | ... | 5 | 6 |

## All three

- Every argument is evaluated, and errors among them follow the checkpoint 4 rules (and the
  checkpoint 34 order the sheet uses). An error wins over every check above: `EDATE(nope, 1.5)` is
  `#NAME?`. Text and ranges (or names for ranges) are `#VALUE!`, as in arithmetic.
- The result is a plain number. Dates have no display of their own (checkpoint 19), a number
  format (checkpoint 41) shows them like any number, and `TEXT` (checkpoint 57) has no date
  formats.
- References inside these functions are precedents (checkpoint 10) and move with insert, delete
  and copy like any other reference.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
