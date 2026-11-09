# Checkpoint 35: saving a workbook

Checkpoint 30 saves one sheet. This checkpoint saves a whole workbook (checkpoint 31) in a second
save format, version 2, and loads it back. `sheet.save()` and `loadSheet` do not change: a sheet
still saves as version 1.

## API

- `book.save()`: returns the workbook as JSON text.
- `loadWorkbook(text)`: a new export of `src/index.mjs`. Returns a new workbook holding exactly what
  the text describes. It also accepts the text of a version 1 sheet save (see Migration).

## The save text

`book.save()` returns exactly what `JSON.stringify` gives for this object, with no spaces or line
ends:

```
{ "format": "workbook", "version": 2, "errorOrder": ..., "sheets": [ { "name": ..., "cells": { ... }, "names": { ... } }, ... ] }
```

- The keys are in that order, and each sheet's keys are in the order `name`, `cells`, `names`.
- `errorOrder` is the workbook's order (checkpoint 34): `"priority"` or `"first"`.
- `sheets` lists the workbook's sheets in `sheetNames()` order, each name as `sheetNames()` gives
  it. A removed sheet is not saved.
- Each sheet's `cells` and `names` are written exactly as that sheet's own `save()` writes them
  (checkpoint 30).
- A workbook with no sheets saves as
  `{"format":"workbook","version":2,"errorOrder":"priority","sheets":[]}` (or `"first"`).
- `book.save()` evaluates nothing, changes nothing and is not recorded for undo.

## Loading

- The new workbook has the saved order, sheets, inputs and names and nothing else. Formulas are
  evaluated when first read, and each sheet's `stats()` starts at `0`. Every sheet's undo and redo
  lists are empty.
- A formula may name a sheet that comes later in `sheets`, or one that is not in the save at all;
  the second gives `#REF!` until a sheet of that name is added (checkpoint 31).
- `loadWorkbook(b.save()).save()` returns the same text as `b.save()`. The loaded workbook and the
  saved one are independent.
- Keys other than those above are ignored, at the top and in each sheet. Spaces and line ends in
  the JSON are allowed.
- `loadSheet` does not accept workbook text: it fails on `format` as before.

## Migration

When the text's `format` is `"sheet"`, `loadWorkbook` reads it as a version 1 sheet save. Every
checkpoint 30 check applies, with the same `cell` values (so a bad cell key gives that key, not a
path). The result is a workbook with order `"priority"` and one sheet, named `Sheet_1`, holding the
saved inputs and names. A formula in it that names `Sheet_1!` now reads its own sheet.

## Errors

`loadWorkbook` throws `{ code: "#LOAD", cell, message }` at the first of these checks that fails,
checked in this order:

| Check | `cell` |
| --- | --- |
| `text` is a string | `""` |
| `text` is valid JSON | `""` |
| it is a JSON object (not an array, not `null`) | `""` |
| `format` is `"sheet"`: the Migration checks follow instead of the rest of this table | |
| `format` is the string `"workbook"` | `"format"` |
| `version` is the number `2` | `"version"` |
| `errorOrder` is `"priority"` or `"first"` (it must be present) | `"errorOrder"` |
| `sheets` is a JSON array | `"sheets"` |

Then for each sheet, in the order written, with `N` its position from `0`, all of these before the
next sheet:

| Check | `cell` |
| --- | --- |
| it is a JSON object | `"sheets.N"` |
| `name` is a valid sheet name (checkpoint 31) | `"sheets.N.name"` |
| no earlier sheet has the same name, ignoring case | `"sheets.N.name"` |
| `cells` is a JSON object | `"sheets.N.cells"` |
| `names` is a JSON object | `"sheets.N.names"` |
| each key of `cells`, as checkpoint 30 checks it | `"sheets.N.cells.<key>"` |
| each key of `names`, as checkpoint 30 checks it | `"sheets.N.names.<key>"` |

For example a lower-case `"a1"` in the second sheet's cells gives `cell` `"sheets.1.cells.a1"`.
