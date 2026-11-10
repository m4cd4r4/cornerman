# Checkpoint 80: API index and final change log

The last checkpoint. The package states its whole public surface in one place, and the change log
is finished.

## API

`apiIndex()`, a new export of the package, returns a new object `{ exports, sheet, workbook }`
each call, three new arrays of names:

- `exports`: the names the package exports, `apiIndex` itself included.
- `sheet`: the name of every method of a sheet.
- `workbook`: the name of every method of a workbook.

Each array is sorted as `Array.prototype.sort` sorts strings with no compare function (by UTF-16
code units), with no name twice. Changing the arrays changes nothing.

## The index

The index is exactly this. It lists the deprecated names of checkpoint 75 too, since a deprecated
name is still public: deprecated does not mean removed. This is NOT what you might expect.

`exports` (6):

```
apiIndex, createSheet, createWorkbook, diffWorkbooks, loadSheet, loadWorkbook
```

`sheet` (69):

```
addresses, canonical, cell, cells, clear, copy, defineConstant, defineName, deleteCols,
deleteRows, dependents, deprecations, display, errorCells, explain, exportJSON, fillDown,
fillRight, find, formula, fromCSV, get, getFormat, getInput, getNote, getStyle, getValidation,
hiddenCols, hiddenRows, hideCols, hideRows, insertCols, insertRows, invalidCells, isProtected,
lint, merge, merges, names, notes, onChange, precedents, protect, protectedCells, recalc, redo,
redoList, removeName, renameName, replace, save, set, setCell, setFormat, setMany, setNote,
setStyle, setValidation, showCols, showRows, sort, stats, text, toCSV, undo, undoList, unmerge,
unprotect, value
```

`workbook` (21):

```
addSheet, batch, copy, defineConstant, defineName, deleteSheet, deprecations, errorCells, get,
names, redo, redoList, removeName, removeSheet, renameName, renameSheet, save, sheet, sheetNames,
undo, undoList
```

## The index matches the objects

- The package's exports are exactly the names in `exports`.
- Every sheet, however it was made (`createSheet`, `loadSheet`, `book.addSheet`, a sheet of a
  loaded workbook, a sheet removed from its workbook), has a function under each name in `sheet`
  as an own property, and no other own property whose value is a function. The same holds for a
  workbook (`createWorkbook`, `loadWorkbook`) and `workbook`. So a helper of your own must not be a
  method of a sheet or a workbook object. This is NOT what you might expect.
- `apiIndex` changes nothing anywhere: no sheet's or workbook's content, undo lists, change
  listeners or deprecation log (checkpoint 75).

## The change log

`CHANGES.md` (checkpoint 40) is now complete: it holds exactly 80 entries, `cp01` to `cp80` in
order, under the rules of checkpoint 40, and no entry for any later checkpoint. As for every entry,
the text of the cp80 entry must not be this checkpoint's title.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
