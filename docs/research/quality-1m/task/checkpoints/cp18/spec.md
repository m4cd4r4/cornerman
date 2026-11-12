# Checkpoint 18: text functions

`LEN(text)`, `UPPER(text)`, `LOWER(text)`, `TRIM(text)`, `LEFT(text)`, `LEFT(text, count)`,
`RIGHT(text)`, `RIGHT(text, count)`, `MID(text, start, count)`.

## Arguments

- `LEN`, `UPPER`, `LOWER` and `TRIM` take exactly one argument, `LEFT` and `RIGHT` one or two, `MID`
  exactly three. Any other number is `#VALUE!` (`cell` = the formula cell).
- The `text` argument is any value, turned into text the way `display` shows it (checkpoint 5): a
  number becomes its display text (`LEN(0.1+0.2)` is 3, from `"0.3"`), a boolean becomes `"TRUE"`
  or `"FALSE"`, an empty cell becomes `""`.
- `count` and `start` are read as in arithmetic (checkpoint 3), then truncated toward zero
  (`2.9` is 2, `-0.5` is 0).
- A range, or a name for a range, in any argument is `#VALUE!`.
- Every argument is evaluated, and errors follow the checkpoint 4 rules.

## Results

- The result of `LEN` is a number. Every other function returns text, even when it looks like a
  number: `LEFT(123, 2)` is the text `"12"`.
- `LEN` counts JavaScript string units (the `.length` of the text).
- `UPPER` and `LOWER` change case the way JavaScript `toUpperCase` and `toLowerCase` do.
- `TRIM` removes spaces (only the character U+0020) from the start and the end. Runs of spaces
  inside the text are kept as they are: `TRIM("  a  b ")` is `"a  b"`. This is NOT what Excel does
  (Excel also shrinks inner runs to one space).
- `LEFT` and `RIGHT` take `count` characters from the start or end. `count` defaults to 1, may be
  0 (giving `""`), and may be larger than the text (giving all of it). A negative `count` is
  `#VALUE!` (`cell` = the formula cell).
- `MID` takes `count` characters starting at position `start` (the first character is 1). A
  `start` below 1, or a negative `count`, is `#VALUE!` (`cell` = the formula cell). A `start` past
  the end gives `""`.

## Coming later

- When list validation arrives, a list rule compares an input with its items exactly: case and
  spaces count, so with the items `Yes` and `No`, the inputs `yes` and `No ` are refused.
- When `SEARCH` arrives, `~` is an ordinary character in its pattern: there is no escape character,
  so a pattern can never match a literal `?` or `*`.
