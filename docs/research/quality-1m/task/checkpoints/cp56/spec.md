# Checkpoint 56: save format version 3

Number formats (checkpoint 41), validation rules (checkpoint 46), merges (checkpoint 47) and hidden
rows and columns (checkpoint 49) have not been saved so far. A workbook save now carries them, in a
third save format, version 3.

## Which version `book.save()` writes

- When at least one sheet of the book has a number format, a validation rule, a merge, a hidden row
  or a hidden column (the "version 3 layers"), `book.save()` writes version 3, below.
- Otherwise it writes version 2 exactly as before: the same text, byte for byte, that checkpoints 35,
  42, 52 and 53 give, notes and workbook names included. Notes and workbook names alone never make
  a version 3 save. So the version depends on what the book holds, and removing the last version 3
  layer (by clearing it, unmerging, showing, or undo) makes the next save version 2 again. This is
  NOT what you might expect.
- `sheet.save()` does not change: it still writes version 1 (checkpoints 30 and 42), with no version
  3 layers, so `loadSheet(sheet.save())` loses them. This is NOT what you might expect. Only a
  workbook save keeps them.

## The version 3 text

Exactly what `JSON.stringify` gives for this object, with no spaces or line ends:

```
{ "format": "workbook", "version": 3, "errorOrder": ..., "sheets": [ { ... }, ... ], "names": { ... } }
```

- The top-level keys are in that order. `errorOrder` and `sheets` are as in version 2. `names` is
  always written, as `book.names()` gives it (checkpoint 53), `{}` when there are none.
- Each sheet entry has exactly these keys, in this order, every one always written, `{}` or `[]`
  when it is empty:
  - `name`, `cells`, `names`: as in version 2.
  - `notes`: as in checkpoint 42, but written as `{}` when the sheet has none.
  - `formats`: address -> format text as `getFormat` gives it, in row-major order as `cells()` orders them (checkpoint 1).
  - `rules`: address -> rule exactly as `getValidation` gives it (`{"type":"whole","min":1,"max":5}`,
    `{"type":"list","items":["a","b"]}`), in row-major order.
  - `merges`: the array `merges()` gives.
  - `hiddenRows`: the array `hiddenRows()` gives. `hiddenCols`: the array `hiddenCols()` gives.
- Like every save, `book.save()` evaluates nothing, changes nothing and is not recorded for undo.

## Loading

- `loadWorkbook` accepts versions 2 and 3. A version 2 text loads exactly as before, and keys it
  does not know are ignored as before, even when they are named like the version 3 keys: a version
  2 text with a `formats` key loads with no formats. A version 1 sheet text is migrated exactly as
  in checkpoint 35.
- A version 3 text loads every layer: values display with their formats, validation refuses inputs,
  covered cells read as empty, and SUBTOTAL leaves out hidden rows, as if each had been set by its
  method. Every sheet's undo and redo lists, and the workbook names list (checkpoint 55), start
  empty. `loadWorkbook(b.save()).save()` returns `b.save()`.
- So a version 1 or version 2 text loaded and saved again gives version 2 text, the same as before
  this checkpoint, until a version 3 layer is added.

## Version 3 load errors

The checks of checkpoints 35, 42 and 53 apply, with `version` now allowed to be `2` or `3`. For a
version 3 text, each sheet entry is then checked further, in this order, after its `notes`, all
before the next sheet. `notes` is required in version 3 and fails as "not a plain object" when it is
missing. `#LOAD` is thrown at the first failure:

| Check | `cell` |
| --- | --- |
| `formats` is a plain object | `sheets.N.formats` |
| each key is an upper-case cell address and its value a format text `setFormat` accepts (not `""`) | `sheets.N.formats.KEY` |
| `rules` is a plain object | `sheets.N.rules` |
| each key is an upper-case cell address and its value a rule written exactly as `getValidation` gives it (same keys, same order, no others) | `sheets.N.rules.KEY` |
| `merges` is an array | `sheets.N.merges` |
| each item is a range of two or more cells written as `merges()` writes it, sharing no cell with an earlier item, and after the item before it in `merges()` order | `sheets.N.merges.I` |
| `hiddenRows` is an array | `sheets.N.hiddenRows` |
| each item is a whole number from 1 to 9999, larger than the item before it | `sheets.N.hiddenRows.I` |
| `hiddenCols` is an array | `sheets.N.hiddenCols` |
| each item is upper-case column letters `A` to `ZZ`, after the item before it in column order | `sheets.N.hiddenCols.I` |

`I` is the item's position from `0`. After every sheet, a version 3 text must have a top-level
`names` object (checked as in checkpoint 53; when it is missing, `cell` = `"names"`).

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
