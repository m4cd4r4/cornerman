# Checkpoint 5: display text

`sheet.display(address)` returns the text a user would see in the cell.

- Empty cell: `""`.
- Text: the text as stored.
- Error value: its `code`, for example `"#DIV/0!"`.
- Number:
  - Rounded to at most 6 decimal places using round-half-to-even ("banker's rounding"):
    `0.0000025` shows as `"0.000002"`, `0.0000035` as `"0.000004"`, `2.5` stays `"2.5"`.
  - Rounding decides on the number's shortest decimal form, the digits JavaScript's `String(x)`
    gives, not on its binary value. `String(x)` may use exponent form (`2.5e-7`); the display never
    does.
  - Trailing zeros after the decimal point are removed, and so is a trailing `.`.
  - A result of zero always shows as `"0"`, never `"-0"`.
  - If the absolute value is 1e15 or more, the display is `"##########"` (ten `#`).
  - Never exponent notation, never thousands separators.
