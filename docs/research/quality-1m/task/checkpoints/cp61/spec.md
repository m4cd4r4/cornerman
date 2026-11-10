# Checkpoint 61: SUBSTITUTE, FIND and SEARCH

Three more text functions: `SUBSTITUTE(text, old, new)`, `SUBSTITUTE(text, old, new, instance)`,
`FIND(find, within)`, `FIND(find, within, start)`, `SEARCH(find, within)` and
`SEARCH(find, within, start)`.

## Arguments

- `SUBSTITUTE` takes three or four arguments, `FIND` and `SEARCH` two or three. Any other number is
  `#VALUE!` (`cell` = the formula cell).
- `text`, `old`, `new`, `find` and `within` are turned into text the way `display` shows a value
  (checkpoint 5), as in checkpoint 18: `FIND(".", 1/4)` looks in `"0.25"` and is 2, and a number of
  1e15 or more is the text `"##########"`. An empty cell is `""`.
- `instance` and `start` are read as in arithmetic and truncated toward zero.
- A range, or a name for a range, in any argument is `#VALUE!`. Every argument is evaluated, and
  errors among them follow the checkpoint 4 rules (and the checkpoint 34 order the sheet uses). An
  error wins over every check below.

## SUBSTITUTE

- Replaces `old` with `new` in `text`, matching with case: `SUBSTITUTE("aAa", "a", "x")` is
  `"xAx"`. Occurrences are found from the left, and one that is replaced is not looked into again:
  `SUBSTITUTE("aaaa", "aa", "X")` is `"XX"`.
- Without `instance`, every occurrence is replaced. With it, only that occurrence, counting from 1
  in the same left-to-right way: `SUBSTITUTE("aaaa", "aa", "X", 2)` is `"aaX"`. An `instance` past
  the last occurrence leaves the text as it is. An `instance` below 1 is `#VALUE!` (`cell` = the
  formula cell).
- An empty `old` leaves the text as it is. `*` and `?` are ordinary characters here.
- The result is always text: `SUBSTITUTE(1234, 3, 9)` is the text `"1294"`.

## FIND and SEARCH

- Both give the position (the first character is 1) of the first place at or after position
  `start` where `find` matches inside `within`. `start` defaults to 1. A `start` below 1 or above
  the length of `within` plus 1 is `#VALUE!` (`cell` = the formula cell).
- An empty `find` matches at once, so the result is `start`: `FIND("", "abc", 4)` is 4.
- When there is no match the result is `#N/A` (`cell` = the formula cell). This is NOT what Excel
  does (Excel gives `#VALUE!`). `#N/A` sits in the priority order of checkpoint 21, so
  `FIND("z", "abc") + 1/0` is `#N/A`, and `IFERROR` catches it.
- `FIND` matches with case and has no wildcards: every character of `find` stands for itself.
- `SEARCH` matches ignoring case, and `find` is a pattern: `?` matches any one character and `*`
  matches any run of characters, none included. Every other character stands for itself, so `.`,
  `(`, `[` and `$` are ordinary. There is no escape character: `~` is an ordinary character, so a
  pattern can never match a literal `?` or `*`. This is NOT what Excel does (in Excel, `~?` matches
  a literal `?`). `SEARCH("~?", "a?b")` is `#N/A`, and `SEARCH("~?", "x~yz")` is 2.

## How they meet earlier checkpoints

- `SUMIF`, `COUNTIF` and `AVERAGEIF` (checkpoints 22 and 43) still have no wildcards, and find and
  replace (checkpoint 51) still matches plain text.
- References inside these functions are precedents, and move with insert, delete and copy as any
  reference does. The text inside a string argument never changes.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
