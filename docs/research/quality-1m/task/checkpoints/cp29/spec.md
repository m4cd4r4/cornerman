# Checkpoint 29: CSV import

## API

- `sheet.fromCSV(text, at = "A1")`: reads CSV `text` and writes its fields into the sheet, the
  first field of the first record landing on `at`. Returns nothing.

## Reading the text

- A record ends at LF (`"\n"`) or CRLF (`"\r\n"`). Both may appear in the same text.
- One line end at the very end of the text adds no record: `"a\nb\n"` is two records. Any further
  line end does: `"a\n\n"` is two records, the second holding one empty field.
- `""` (the empty text) has no records and changes nothing.
- Fields are separated by `,`. A field that starts with `"` is quoted: it runs to the next `"`
  that is not doubled, `""` inside it stands for one `"`, and it may hold `,`, CR and LF. Spaces
  and tabs are kept exactly; nothing is trimmed.
- Records may have different numbers of fields.

## Malformed text

The text is malformed, and `fromCSV` throws `{ code: "#CSV", cell, message }`, when any record has:

- a quoted field with no closing `"`,
- anything other than `,` or a line end straight after a closing `"`,
- a `"` inside a field that did not start with `"`,
- a CR that is not followed by LF, outside a quoted field.

`cell` is the number of the first bad record, counting from 1, as a string (`"2"`). A line end
inside a quoted field does not end the record, so it does not add to the count.

## Writing

- Field `j` (from 0) of record `i` (from 0) is written to the cell `i` rows below and `j` columns
  right of `at`, exactly as `set(cell, field)` would write it. A field is an input, so `"=1+1"`,
  quoted or not, becomes a formula and `"007"` becomes the number 7 (checkpoint 1).
- Formula fields are written as they are. Their references are NOT moved by `at`: `=A1` read at
  `C3` still points at `A1`. This is NOT what Excel does.
- An empty field clears its cell. A cell to the right of a short record's last field, or below the
  last record, is left as it was.
- `at` may be lower case. A `$`, a range or anything else that is not one cell address throws
  `{ code: "#ADDR", cell: at, message }`.

## Errors and order

`fromCSV` checks, in this order, and throws at the first failure:

1. `at` (`#ADDR`, above).
2. `text` is a string. Otherwise `{ code: "#ARG", cell: String(text), message }`.
3. The text is well formed (`#CSV`, above).
4. Every field fits on the sheet. If a record would reach past row 9999, or a field past column
   `ZZ`, it throws `{ code: "#FULL", cell: at, message }`.

A call that throws changes nothing.

## Undo

`fromCSV` is undoable as one step however many cells it wrote, recorded only if at least one
cell's input changed (checkpoint 27). Undoing or redoing it counts, for evaluation, as setting
the cells it changed.

## Coming later

- When CSV import options arrive, we agree: with `types: "text"`, a field that matches the number
  grammar of checkpoint 1, or starts with `=`, is written as `="` + the field with every `"`
  doubled + `"`, so `007` is written as the input `="007"`. Every other field, and the empty field,
  is written as it is.
