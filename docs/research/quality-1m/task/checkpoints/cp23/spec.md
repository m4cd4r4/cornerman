# Checkpoint 23: insert rows

## API

- `sheet.insertRows(at, count = 1)`: inserts `count` empty rows above row `at`. Every cell in row
  `at` or below moves down by `count` rows, keeping its input.
- `at` must be a whole number from 1 to 9999, `count` a whole number of at least 1, and
  `at + count - 1` must not pass 9999. Otherwise it throws `{ code: "#ARG", cell: String(at),
  message }` and changes nothing.
- If any non-empty cell would move past row 9999, it throws `{ code: "#FULL", cell: String(at),
  message }` and changes nothing. The argument checks come first: a call that fails both is `#ARG`.

## Formula text

Every formula's text is rewritten so it still points at the same cells. `getInput` returns the new
text.

- A reference to row `at` or below gains `count` rows: with `at` = 3, `A3` becomes `A4`, `B2` stays.
- The two corners of a range are moved one at a time, by the same rule. So, inserting one row:
  `A2:A5` at 3 becomes `A2:A6` (the range grows), at 2 becomes `A3:A6` (it moves), at 6 stays
  `A2:A5`. A range written bottom corner first keeps that order.
- A reference that would pass row 9999 becomes `#REF!`. If either corner of a range would, the
  whole range (both corners and the `:`) becomes `#REF!`. The text `#REF!` in a formula evaluates
  to `#REF!` (`cell` = the formula cell).
- Only references change. A reference that moves is written in upper case. A reference that does
  not move, and all other text (spaces, function names, names, numbers, the inside of strings),
  stays exactly as typed: `=sum(a5:a2)&"A5"` with 2 rows inserted at 3 becomes
  `=sum(A7:a2)&"A5"`.
- A word followed by `(` is a function name, never a reference (`LOG10(1)` is unchanged).
- A formula whose text is `#PARSE!` (checkpoint 2) is left exactly as typed.

## Names and recalculation

- Defined names move the same way: each corner of the target moves by the rule above. A name whose
  target would pass row 9999 is removed.
- After `insertRows`, every formula in the sheet needs evaluation again (checkpoints 8 and 11), and
  precedents, dependents and cycles follow the new text.
