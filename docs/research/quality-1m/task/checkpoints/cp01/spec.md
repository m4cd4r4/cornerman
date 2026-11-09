# Checkpoint 1: cell store

Build the start of a spreadsheet engine in `src/`. The public entry point is `src/index.mjs`, which
exports `createSheet()`. It returns a sheet object.

## API

- `sheet.set(address, input)`: `input` is always a string. Stores it in the cell.
- `sheet.get(address)`: the cell's value. `null` for an empty cell, otherwise a number or a string.
- `sheet.cells()`: the addresses of every non-empty cell, upper case, in the order defined below.

## Addresses

- One or two letters, then a row number from 1 to 9999. Columns run A..Z, then AA..ZZ.
- Letters are case-insensitive: `a1` and `A1` are the same cell.
- The row number has no leading zero (`A01` is invalid) and no sign.
- An invalid address makes `set` and `get` throw. The thrown value has the shape
  `{ code, cell, message }` with `code` = `"#ADDR"`, `cell` = the address exactly as passed in,
  and `message` a non-empty string.

## Input

- An input is a number when the WHOLE string matches: optional `-`, one or more digits, and
  optionally a `.` followed by one or more digits. Nothing else counts: no `+`, no exponent, no
  spaces, no thousands separators, no leading or trailing `.`.
- A number input is stored as a JavaScript number. `-0` is stored as `0`. Leading zeros are allowed
  (`007` is the number 7).
- Any other input is text, stored exactly as given (no trimming).
- The empty string clears the cell.

## Order of `cells()`

Row-major: all of row 1 first, then row 2, and so on. Within a row, columns in sheet order
(A..Z, then AA..ZZ).
