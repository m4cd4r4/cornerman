# Checkpoint 41: number formats

A cell can now carry a number format. The format changes only the text `display` gives for a
number in that cell; the value is unchanged.

## API

- `sheet.setFormat(target, format)`: gives every cell of `target` the format. `target` is one
  address (`"B2"`) or a range of two addresses joined by `:` (`"A1:C3"`, corners in any order).
  `format` `null` or `""` removes the format from those cells. Returns `undefined`.
- `sheet.getFormat(address)`: the cell's format text, or `null` when it has none.

## Formats

A format is, exactly and with nothing else in it:

1. optionally `#,##` (group the whole part in threes with `,`),
2. then `0`,
3. optionally `.` followed by 1 to 10 zeros (that many decimal places),
4. optionally `%` at the end.

So `0`, `0.00`, `#,##0`, `#,##0.000`, `0%` and `0.0%` are formats; `#,##0.`, `0.00000000000`
(11 zeros), `##0`, `General`, `0 %` and ` 0` are not. Formats are matched with their case and
spaces as typed.

## What display shows

For a cell whose value is a number and that has a format:

- `%` formats show the number times 100, followed by `%`. The digits are moved two places, not
  multiplied in floating point: `0.575` with `0%` is `"58%"`.
- The number is rounded to the format's decimal places, half to even, deciding on the number's
  shortest decimal form, as checkpoint 5 does: `1.005` with `0.00` is `"1.00"`, `0.125` with
  `0.00` is `"0.12"`, `2.5` with `0` is `"2"`, `3.5` with `0` is `"4"`. This is NOT what Excel does
  (Excel rounds halves away from zero and shows `"1.01"`, `"0.13"`, `"3"`).
- Exactly that many decimal places are shown, padded with zeros: `5` with `0.00` is `"5.00"`. With
  no decimal places there is no `.`.
- With `#,##`, the whole part is grouped: `1234567.891` with `#,##0.00` is `"1,234,567.89"`.
- A negative number gets a leading `-`, unless every digit shown is zero: `-0.004` with `0.00` is
  `"0.00"`, `-0.0051` is `"-0.01"`.
- A number whose absolute value is 1e15 or more still shows `"##########"` (checkpoint 5).

A cell whose value is not a number (text, a boolean, an error, an empty cell) shows what
checkpoint 5 says, whatever its format. A cell with no format shows what checkpoint 5 says.

## The format belongs to the cell, not to its value

- `get` and every formula see the number, never the formatted text. A formula that reads a
  formatted cell has no format of its own: with `A1` = `0.5` formatted `0%`, `=A1` displays
  `"0.5"` and `=A1&""` is the text `"0.5"`. This is NOT what Excel does (Excel often gives a new
  formula the format of the cell it reads).
- `set` never changes a format: clearing a cell's input keeps its format, and a number typed there
  later is shown with it.
- `toCSV()` (checkpoint 28) writes what `display` shows, so formatted numbers, quoted when needed:
  `1234` formatted `#,##0` is written `"1,234"`. `toCSV({ formulas: true })` is unchanged.
- Formats are per sheet. A formula reading another sheet's cell gets its number.
- `save()` and `book.save()` do not write formats in this checkpoint, and a loaded sheet has none.

## Other changes

- Undo (checkpoint 27): one `setFormat` call is one undo step, whatever the size of the target. A
  call that changes no cell's format is not recorded.
- Insert and delete (checkpoints 23-25): a format moves with its cell, and a format in a deleted
  row or column is gone. Inserted rows and columns have no format. This is NOT what Excel does
  (Excel gives an inserted row the format of the row above it). Undo of an insert or delete puts
  the formats back as well.
- Copy (checkpoint 26): `copy` copies each source cell's format to its target cell, in the same
  undo step as the inputs. A source cell with no format removes the target cell's format.
- `book.renameSheet` (checkpoint 37) does not change any format.

## Errors

`setFormat` checks, in this order, and throws at the first failure, changing nothing:

| Check | `code` | `cell` |
| --- | --- | --- |
| `target` is an address or a range as above | `#ADDR` | `String(target)` |
| `target` holds at most 10,000 cells | `#ARG` | `target` |
| `format` is `null`, `""` or a format as above | `#FORMAT` | `String(format)` |

`getFormat` throws for an invalid address as `get` does (checkpoint 1).

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
