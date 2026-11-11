# Checkpoint 7: literals inside formulas

- String literals in double quotes. A doubled quote inside is one quote: `="say ""hi"""` gives
  `say "hi"`. An unterminated string is `#PARSE!`. A string literal is text, so in arithmetic it is
  `#VALUE!` (checkpoint 3) even when it looks like a number: `="5"+1` is `#VALUE!`, not 6. This
  is NOT what Excel does.
- `TRUE` and `FALSE`, case-insensitive, are boolean literals.
- Postfix `%` divides the value before it by 100. It binds tighter than everything, including
  `^`: `=2^50%` is `2^0.5`, and `=-50%` is -0.5. It can repeat: `=50%%` is 0.005.
- Any other bare word (letters only, not a cell reference) is an unknown name: `#NAME?` with
  `cell` = the formula cell. It still sits in the checkpoint 4 priority order.
