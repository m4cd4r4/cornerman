# Checkpoint 2: arithmetic formulas

An input that starts with `=` is a formula. `get` returns its computed value.

## API

- `sheet.getInput(address)`: the raw string last set in the cell, or `null` if empty.

## Grammar

- Number literals inside a formula: one or more digits, optionally `.` and one or more digits.
  A sign is an operator, not part of the literal.
- Binary operators `+ - * /` and `^` (power). Unary `-` and `+`. Parentheses.
- Whitespace may appear between any two tokens.

## Precedence, highest first

1. `^`, right-associative: `=2^3^2` is 512.
2. Unary `-` and `+`. Power binds tighter than unary minus: `=-2^2` is -4.
3. `*` and `/`, left-associative.
4. `+` and `-`, left-associative.

## Error values

A formula can produce an error value instead of a number. An error value is a plain object
`{ code, cell, message }`: `code` is the error code, `cell` is the upper-case address of the cell
where the error arose, `message` is a non-empty string. `get` returns it; it is not thrown.

- Division by zero: `#DIV/0!`.
- A formula that does not parse: `#PARSE!`. The input is still stored, and `getInput` returns it.
