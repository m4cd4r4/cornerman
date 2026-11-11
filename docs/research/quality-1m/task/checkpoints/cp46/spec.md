# Checkpoint 46: data validation

A cell can now carry a validation rule. Inputs typed into it from outside the sheet are checked
against the rule, and refused when they break it.

## API

- `sheet.setValidation(target, rule)`: gives every cell of `target` the rule. `target` is an
  address or a range, as for `setFormat` (checkpoint 41). `rule` `null` removes the rule from those
  cells. Inputs already in the cells are not checked. Returns `undefined`.
- `sheet.getValidation(address)`: the cell's rule as a new plain object, or `null`.
- `sheet.invalidCells()`: the addresses (upper case, row-major) of the cells whose current input
  breaks their rule. `[]` when there are none.

## Rules

A rule is a plain object of one of two kinds. Other keys are ignored and not kept.

- `{ type: "whole", min, max }`: `min` and `max` are integers (JavaScript numbers for which
  `Number.isInteger` is true) and `min <= max`. An input passes when it is a number by the
  checkpoint 1 grammar whose value is a whole number from `min` to `max`, both included. `"5.0"`
  passes for 1 to 10; `"5.5"`, `" 5"`, `"1e1"` and `"TRUE"` do not.
- `{ type: "list", items }`: `items` is an array of 1 to 50 non-empty strings. An input passes
  when it is exactly one of the items, case and spaces included: with items `["Yes", "No"]`,
  `"yes"` and `"No "` are refused. This is NOT what you might expect (a list check that ignores
  case).
- For both kinds, the empty input `""` (clearing the cell) always passes, and so does any formula
  (an input starting with `=`), whatever its value. This is NOT what you might expect (the value a
  formula gives is never checked).

`getValidation` gives `{ type: "whole", min, max }` or `{ type: "list", items: [...] }` with keys
in that order. Changing the object it returned does not change the rule.

## What is checked

- `set`, `setCell`, `setMany` (checkpoint 33) and `fromCSV` (checkpoint 29) check every input
  they would write, before writing any. At the first input that a cell's rule refuses they throw
  `#INVALID` with `cell` = that address in upper case, and nothing is written. The check runs even
  when the input is the one the cell already holds.
- `setMany` first checks every address (as before), then the inputs in the order the object
  lists them. `fromCSV` checks its arguments and CSV text as before (`#ADDR`, `#CSV`, `#FULL`,
  checkpoint 29), then the inputs in row-major order.
- Nothing else checks: `copy` (checkpoint 26), `undo`, `redo`, insert and delete, and
  `book.renameSheet` write what they write, so a cell can end up holding an input its rule
  refuses. `invalidCells()` lists such cells.

## Rules belong to the cell

- `copy` does not copy rules: target cells keep the rules they had, and its writes are not
  checked. This is NOT what Excel does (Excel's paste gives the target the source's validation).
- Insert and delete (checkpoints 23-25) move a rule with its cell; a rule in a deleted row or
  column is gone; inserted cells have none. An insert or delete that moves or removes a rule is
  recorded as one undo step (checkpoint 27) even when it moves no input, formula or name.
- Undo (checkpoint 27): one `setValidation` call is one undo step; a call that changes no cell's
  rule is not recorded. Undo and redo of other changes are never checked.
- Rules are per sheet. `save()` and `book.save()` do not write rules in this checkpoint.

## Errors

`setValidation` checks, in this order, and throws at the first failure, changing nothing:

| Check | `code` | `cell` |
| --- | --- | --- |
| `target` is an address or a range | `#ADDR` | `String(target)` |
| `target` holds at most 10,000 cells | `#ARG` | `target` |
| `rule` is `null` or a rule as above | `#RULE` | `String(target)` |

`getValidation` throws for an invalid address as `get` does.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
