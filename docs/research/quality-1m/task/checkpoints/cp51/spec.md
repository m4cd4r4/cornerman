# Checkpoint 51: find and replace

A sheet can now search its cell inputs for a piece of text, and replace it. The search is over
inputs as `getInput` gives them (formula text included), never over values or display text.

## API

- `sheet.find(text, opts)`: the addresses (upper case, row-major order, as `cells()` orders them)
  of the cells whose input contains `text`. `[]` when there are none.
- `sheet.replace(text, replacement, opts)`: in every cell whose input contains `text`, replaces
  each occurrence of `text` with `replacement`. It returns a number.
- `opts` is optional: an object with two optional booleans, `matchCase` (default `false`) and
  `whole` (default `false`). Other keys are ignored.

## Matching

- `text` is plain text. Every character stands for itself: `*`, `?` and `~` are not wildcards, so
  `find("*")` finds only inputs that hold a `*`. This is NOT what Excel does.
- Without `matchCase`, letters match ignoring case (as JavaScript's `toLowerCase()` compares
  them). With `matchCase: true`, they must match exactly.
- With `whole: true`, a cell matches only when its whole input equals `text` (ignoring case unless
  `matchCase`), and `replace` then makes `replacement` the whole new input.
- The input is searched as typed, the leading `=` of a formula included: `find("=")` finds every
  formula, `find("1+")` finds `=1+1` but `find("2")` does not, and a number formatted as `1,000`
  (checkpoint 41) is found by `"1000"`, not by `"1,000"`. Notes, names, formats and the other
  layers are never searched.
- Every cell with an input is searched, including cells in hidden rows and columns (checkpoint 49).
  A covered cell of a merge (checkpoint 47) is not: `find` never lists it and `replace` never
  changes it, although `getInput` still gives its hidden input. This is NOT what you might expect.

## Replacing

- In each cell, the occurrences are found in the input as it was, left to right, without overlap
  (after a match, the search goes on after its end), and every one is replaced by `replacement` as
  given. The new text is not searched again: `"aaa"` with `"aa"` replaced by `"b"` becomes `"ba"`.
- The new input is stored as if typed with `set`: it is parsed again, `""` empties the cell, and a
  formula's references are just text, so replacing `A1` with `B1` also turns `=A10` into `=B10`.
- A cell whose new input is the same as its old one is not changed.
- Before writing anything, `replace` checks every new input against the cell's validation rule
  (checkpoint 46), in row-major order. If one is refused, it throws `#INVALID` with `cell` = that
  address, and changes nothing.
- One `replace` that changes at least one cell is one undo step (checkpoint 27); one that changes
  nothing records nothing. `find` changes nothing, evaluates nothing and is not recorded.

## Errors

Checked in this order, before anything is searched; each throws and changes nothing:

| Check | `code` | `cell` |
| --- | --- | --- |
| `text` is a non-empty string | `#ARG` | `String(text)` |
| (`replace` only) `replacement` is a string, possibly empty | `#ARG` | `String(replacement)` |
| `opts` is absent, or an object (not `null`, not an array) whose `matchCase` and `whole` are each absent or a boolean | `#ARG` | `"opts"` |

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
