# Checkpoint 21: VLOOKUP

`VLOOKUP(key, table, column)`: finds `key` in the first column of `table` and returns the value in
the given column of that row.

## Arguments

- Exactly three arguments. Any other number is `#VALUE!` (`cell` = the formula cell). There is no
  fourth "approximate match" argument: matching is always exact. This is NOT what Excel does
  (Excel's default is an approximate match).
- `key` is any value.
- `table` is a range argument (a bare range, a bare reference, or a name, as in checkpoints 13 and
  14). Any other expression is `#VALUE!`. A bad range is `#REF!` as in checkpoint 13.
- `column` is read as in arithmetic and truncated toward zero. Column 1 is the table's first
  column. A column below 1 or past the table's last column is `#REF!` (`cell` = the formula cell).
  This is NOT what Excel does (Excel gives `#VALUE!` for a column below 1).
- All three arguments are evaluated, and errors among them follow the checkpoint 4 rules. An
  error in an argument comes before the function's own checks: if any argument is an error, the
  result is the winning error among the arguments, and no column check or search is made. So
  `VLOOKUP(1/0, A1:B9, 0)` is `#DIV/0!`, not the `#REF!` of column 0.

## Matching

- Rows are searched from the top. The first row whose first-column cell matches `key` wins.
- A cell matches only a key of the same type: a number matches a number (equal within the
  checkpoint 8 tolerance), text matches text (ignoring case, as in checkpoint 6), a boolean matches
  the same boolean. The text `"1"` never matches the number 1.
- Empty cells and error cells in the first column never match.
- An empty `key` (a reference to an empty cell) matches nothing.
- No match is `#N/A` (`cell` = the formula cell).
- `#N/A` is a new error code. In the checkpoint 4 priority order it sits between `#NAME?` and
  `#VALUE!`, so the whole order is now, highest first: `#CYCLE!`, `#REF!`, `#NAME?`, `#N/A`,
  `#VALUE!`, `#DIV/0!`.

## Result

- The value of the cell in the matched row and the given column, exactly as reading that cell
  would give it: an empty cell gives 0, and an error cell gives its own error.
- Every cell of `table` is referred to by the formula (checkpoints 9 and 10).

## Coming later

- When `MATCH` arrives, a call without a `type` is an exact match, the same as `type` 0.
- When `errorCells` arrives (one list for a sheet, one for a workbook), we agree: each list is
  ordered by error code in the priority order, highest first, with `#PARSE!` last, and row-major by address
  within one code. A workbook's list orders by code across all its sheets first, then by sheet
  order, then row-major. Every list keeps this order whatever a sheet's setting for which error
  wins.
