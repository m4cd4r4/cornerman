# Checkpoint 57: TEXT

`TEXT(value, format)` gives a value as text, the way a number format (checkpoint 41) shows it.

## Arguments

- Exactly two arguments. Any other number is `#VALUE!` (`cell` = the formula cell).
- Both arguments are evaluated, and errors among them follow the checkpoint 4 rules (and the
  checkpoint 34 order the sheet uses). A range, or a name for a range, in either argument is
  `#VALUE!`, as for any value (checkpoint 13).
- `format` is turned into text the way `display` shows it (checkpoint 5), as the text functions
  of checkpoint 18 do: `TEXT(2.5, 0)` uses the format `"0"`.
- The format text must be a format exactly as checkpoint 41 defines them, with its case and spaces
  as typed: `0`, `0.00`, `#,##0.0`, `0%` and so on. Anything else, including `""`, `"General"`,
  `"0.00 "` and `"yyyy-mm-dd"`, is `#VALUE!` (`cell` = the formula cell). This is NOT what Excel
  does (Excel's TEXT takes any format code, dates and `General` included). The format is checked
  whatever the value is, but only after both arguments gave no error: `TEXT(1/0, "bad")` is
  `#DIV/0!`.

## The result

The result is always text, even when it looks like a number: `TEXT(5, "0")` is the text `"5"`, so
`TEXT(5, "0") + 1` is `#VALUE!` (checkpoint 3).

- A number is shown exactly as checkpoint 41 shows a cell with that format: rounded half to even on
  the number's shortest decimal form (`TEXT(0.125, "0.00")` is `"0.12"`, `TEXT(2.5, "0")` is `"2"`),
  exactly that many decimal places, `%` moving the digits two places (`TEXT(0.575, "0%")` is
  `"58%"`), `#,##` grouping the whole part, a `-` only when a digit shown is not zero, and
  `"##########"` for an absolute value of 1e15 or more.
- An empty cell is the number 0: with `A1` empty, `TEXT(A1, "0.00")` is `"0.00"`. This is NOT what
  you might expect (the text functions of checkpoint 18 read an empty cell as `""`).
- Any other value is returned as `display` would show it, with the format not applied: a boolean
  is `"TRUE"` or `"FALSE"`, and text is returned unchanged even when it looks like a number:
  `TEXT("5", "0.00")` is `"5"`, and so is `TEXT(A1, "0.00")` when `A1` holds `="5"`. This is NOT
  what Excel does (Excel reads number-like text as the number and gives `"5.00"`). A cell whose
  input is `5` holds the number 5 (checkpoint 1), so `TEXT` of it is `"5.00"`.

## How it meets earlier checkpoints

- Cell number formats (checkpoint 41) play no part. `TEXT(A1, "0%")` uses `"0%"` whatever format
  `A1` has, and a cell holding a `TEXT` formula holds text, so a format given to that cell changes
  nothing it shows.
- References inside `TEXT` are references like any other: they are precedents (checkpoint 10), they
  move with insert and delete (checkpoints 23-25) and copy (checkpoint 26), and the format text, a
  string, never changes. A name or a constant (checkpoints 14, 52, 53) may give either argument.
- `toCSV()` writes a `TEXT` result as the text it is, quoted when it needs quotes (checkpoint 28):
  `TEXT(1234, "#,##0")` is written `"1,234"`.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
