# Checkpoint 63: decimal comma

A sheet or a workbook can now show numbers with a decimal comma, as many countries write them:
`1234.5` shown as `"1234,5"`, or with the format `#,##0.00` (checkpoint 41) as `"1.234,50"`.

## The option

- `createSheet(options)`, `loadSheet(text, options)`, `createWorkbook(options)` and now
  `loadWorkbook(text, options)` take the key `decimal`: `"."` (the default, everything as before)
  or `","`.
- Options are checked as in checkpoint 34, before anything else, in this order: `options` is an
  object (`#ARG`, `cell` `""`), then `errorOrder`, then `decimal`. Any `decimal` other than the two
  above throws `{ code: "#ARG", cell: String(decimal), message }`.
- `loadWorkbook` checks `errorOrder` in its options like the others, but its error order still comes
  from the save text (checkpoint 35). Only `decimal` is taken from its options.
- All sheets of a workbook use the workbook's `decimal`, including a sheet after it is removed or
  deleted (checkpoints 31 and 54), as with the error order.

## What changes: the text shown for a number

With `decimal: ","`, wherever a number's display text is made, `.` and `,` change places. That is
`display`, `text` (checkpoint 33) and `toCSV()` (checkpoint 28):

- A number with no format: its checkpoint 5 text with `,` for the point: `0.5` is `"0,5"`, `-2.25`
  is `"-2,25"`, `1/3` is `"0,333333"`.
- A number with a format (checkpoint 41): the decimal places after `,`, and `#,##` groups joined
  by `.`: `1234567.891` with `#,##0.00` is `"1.234.567,89"`; `0.125` with `0.0%` is `"12,5%"`.
  Format texts are still written with `.` and `,` as in checkpoint 41: `setFormat(a, "0,00")` is
  still `#FORMAT`.
- `"##########"`, booleans, error codes and empty cells show as before. Text is shown exactly as it
  is, even text that holds a `.`: with `A1` = `0.5`, `=A1&""` is the text `"0.5"`, so it shows
  `"0.5"` while `A1` shows `"0,5"`. This is NOT what you might expect.

## What does not change

- Inputs are read exactly as before. `set("A1", "1,5")` stores the text `"1,5"`, and `"1.5"` is
  still the number 1.5. Formulas are written as before: `.` is the decimal point and `,` separates
  arguments. `fromCSV` (checkpoint 29) writes its fields as inputs, so the same holds there. This
  is NOT what Excel does (Excel reads typed numbers and formulas in the locale).
- Formulas never see the option. Every value is the same in both settings, and so is every text a
  formula makes: `&`, the text functions (checkpoints 18 and 61) and `TEXT` (checkpoint 57) use `.`
  as always: `TEXT(1234.5, "#,##0.0")` is `"1,234.5"` in both, and `LEN(0.25)` is 4.
- `toCSV()` still separates fields with `,`, and a field is quoted by the checkpoint 28 rules, so a
  number shown with a comma is written in quotes: `0.5` and `2` in a row are written `"0,5",2`. This
  is NOT what Excel does (Excel separates fields with `;` in such a locale). `toCSV({ formulas: true
  })` writes inputs and does not change.
- The option is not saved. `save()` and `book.save()` give the same text with either setting, and
  `loadSheet` and `loadWorkbook` use the option passed to them, `"."` when none is.
- Nothing else uses it: `get`, `getInput`, `canonical`, `explain`, find and replace, sort, names and
  undo all work as before.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
