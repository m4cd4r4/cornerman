# Checkpoint 69: CSV import options

`fromCSV` (checkpoint 29) now takes options.

## API

- `sheet.fromCSV(text, at = "A1", opts)`: `opts` is optional; when given it is a plain object with
  any of the keys below. A key that is missing or `undefined` takes its default. Other keys are
  ignored.
  - `delimiter`: the character that separates fields. Default `","`.
  - `header`: `true` or `false`. Default `false`.
  - `types`: `"auto"` or `"text"`. Default `"auto"`.
- Without `header: true`, `fromCSV` returns `undefined`, as before. With `header: true` it returns
  the fields of the first record as a new array of strings, or `null` when the text has no record.

Without `opts`, or with every key at its default, `fromCSV` does exactly what checkpoint 29 says.

## delimiter

- One character, which must not be `"`, CR or LF. It takes the place of `,` everywhere in the
  checkpoint 29 rules: between fields, and as what may follow a closing `"`. Any other character,
  `,` included, is an ordinary character in a field: with `delimiter: ";"`, `a,b;c` is two fields,
  `a,b` and `c`. Tabs (`"\t"`) and spaces work like any other delimiter.
- The `decimal` option (checkpoint 63) never changes how fields are read. With `delimiter: ";"` on a
  sheet with `decimal: ","`, the field `1,5` is written as the input `1,5`, which is text. This is
  NOT what Excel does (Excel reads it as the number 1.5 in a decimal-comma locale).

## header

- With `header: true`, the first record of the text is the header. It is read and checked like any
  other record, but it is not written: the second record lands on `at`. The `#FULL` check
  (checkpoint 29) is made on the records that are written.
- Record numbers in `#CSV` errors still count every record of the text, the header included: a bad
  second line is `cell` `"2"`. This is NOT what you might expect.
- A text with only a header writes nothing and records no undo step.

## types

- `"auto"`: every field is written exactly as it is, as in checkpoint 29.
- `"text"` follows what we agreed when CSV import was built.
- Validation rules (checkpoint 46) and the formula limits (checkpoint 67) check the input as
  written.

Everything else is as in checkpoint 29 and later: one undo step, merges refuse covered cells
(checkpoint 47), one change event (checkpoint 65).

## Errors and order

`fromCSV` checks, in this order, and throws at the first failure, changing nothing:

1. `at` (`#ADDR`, checkpoint 29).
2. `opts`, when given, is a plain object (not `null`, not an array): `#ARG`, `cell` `"opts"`.
3. `delimiter`: `#ARG`, `cell` `String(delimiter)`.
4. `header`: `#ARG`, `cell` `String(header)`.
5. `types`: `#ARG`, `cell` `String(types)`.
6. `text` is a string (`#ARG`), the text is well formed (`#CSV`), every written field fits (`#FULL`),
   then each written cell in row-major order: `#MERGE`, `#LIMIT`, `#INVALID`, as before.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
