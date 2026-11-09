# Checkpoint 30: save and load

## API

- `sheet.save()`: returns the sheet's cell inputs and defined names as JSON text.
- `loadSheet(text)`: a new export of `src/index.mjs` beside `createSheet`. Returns a new sheet
  holding exactly what the text describes.

## The save text

`save()` returns exactly what `JSON.stringify` gives for this object, with no spaces or line ends:

```
{ "format": "sheet", "version": 1, "cells": { ... }, "names": { ... } }
```

- The keys are in that order: `format`, `version`, `cells`, `names`.
- `cells` maps each non-empty cell's address to its input (`getInput`), in the order `cells()`
  lists them (checkpoint 1).
- `names` maps each defined name to its target, as `names()` gives them (checkpoint 14), in the
  same sorted order. A name defined as `"A1:A1"` keeps that target; it is not written as `"A1"`.
- Values, the evaluation cache, `stats()` and the undo and redo lists are not saved. An empty
  sheet saves as `{"format":"sheet","version":1,"cells":{},"names":{}}`.
- `save()` evaluates nothing, changes nothing and is not recorded for undo.

## Loading

- The new sheet has the saved inputs and names and nothing else. Its formulas are evaluated when
  first read, as for any sheet, and counted in its own `stats()`, which starts at `0`. Its undo and
  redo lists are empty: `undo()` returns `false`.
- `loadSheet(s.save()).save()` returns the same text as `s.save()`.
- The loaded sheet and the sheet that was saved are independent: changing one does not change the
  other.
- Keys other than the four above are ignored. Spaces and line ends around and inside the JSON are
  allowed. The cells may be in any order; `save()` on the loaded sheet writes them in `cells()`
  order.

## Errors

`loadSheet` throws `{ code: "#LOAD", cell, message }` at the first of these checks that fails,
checked in this order:

| Check | `cell` |
| --- | --- |
| `text` is a string | `""` |
| `text` is valid JSON | `""` |
| it is a JSON object (not an array, not `null`) | `""` |
| `format` is the string `"sheet"` | `"format"` |
| `version` is the number `1` | `"version"` |
| `cells` is a JSON object | `"cells"` |
| `names` is a JSON object | `"names"` |
| each key of `cells`, in the order written, is an upper-case cell address and its value a non-empty string | that key |
| each key of `names`, in the order written, is a valid name (checkpoint 14) written in upper case, and its value a valid target written exactly as `names()` would write it | that key |

So `"a1"` as a cell key, `"rate"` as a name, and a target written `"B3:A1"` or `"b2"` are all
rejected, even though `set` and `defineName` accept them.
