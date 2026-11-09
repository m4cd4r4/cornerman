# Checkpoint 22: SUMIF

`SUMIF(range, criterion)` or `SUMIF(range, criterion, sumRange)`: adds the numbers in `sumRange`
at the positions where the cell in `range` meets `criterion`. Without `sumRange`, the numbers in
`range` itself are added.

## Arguments

- Two or three arguments. Any other number is `#VALUE!` (`cell` = the formula cell).
- `range` and `sumRange` are range arguments (a bare range, a bare reference, or a name). Any other
  expression is `#VALUE!`. A bad range is `#REF!` as in checkpoint 13.
- `sumRange` must have the same width and height as `range`, otherwise `#VALUE!` (`cell` = the
  formula cell). Positions are matched row by row, left to right. This is NOT what Excel does (Excel
  resizes `sumRange` to fit).
- `criterion` is any value. All three arguments are evaluated, and errors among them follow the
  checkpoint 4 rules.

## The criterion

- A number means "equal to that number". A boolean means "equal to that boolean". An empty cell
  means "blank".
- Text is an optional operator followed by an operand. The operators are `=`, `<>`, `<`, `>`,
  `<=`, `>=`. No operator means `=`.
- An operand that matches the checkpoint 1 number grammar (`5`, `-2.5`) is a number. Any other
  operand is text, compared ignoring case. `*` and `?` are ordinary characters, not wildcards. The
  text `"TRUE"` is text, not a boolean. Both are NOT what Excel does.
- An empty operand (`"="`, `""`, `"<>"`) is "blank".

## Matching a cell

- "Blank" is an empty cell or the text `""`.
- `=` with a blank operand matches blank cells. `=` with any other operand matches a cell of the
  same type with an equal value (numbers within the checkpoint 8 tolerance, text ignoring case). A
  criterion of `"5"` matches the number 5 but not the text `"5"`. This is NOT what Excel does
  (Excel matches both).
- `<>` matches exactly the cells that `=` with the same operand does not match, blanks included.
- `<`, `>`, `<=`, `>=` match only cells of the same type as the operand, compared as in
  checkpoint 6. They never match blanks, and with a blank operand they match nothing.
- An error cell in `range` never matches anything, not even `<>`.

## Adding

- At each matching position, a number in `sumRange` is added. Text, booleans and empty cells are
  skipped.
- An error at a matching position in `sumRange` is collected; if any were collected, the winner by
  the checkpoint 4 rules is the result. Errors at positions that do not match are ignored.
- No matches gives 0.
- Every cell of `range` and `sumRange` is referred to by the formula (checkpoints 9 and 10).
