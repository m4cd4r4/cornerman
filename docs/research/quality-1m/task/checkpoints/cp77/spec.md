# Checkpoint 77: range export to JSON

A sheet can now write a range of its cells as JSON text, with their values or the text they show,
and their number formats.

## API

`sheet.exportJSON(target, opts)` returns a string: the JSON text of an object written as
`JSON.stringify` writes it (no spaces), with these keys in this order:

- `range`: the range written top-left corner, `:`, bottom-right corner, upper case. It always has
  two corners, also for one cell: `exportJSON("b2")` gives `"range":"B2:B2"`. This is NOT what you
  might expect.
- `values`: one array per row of the range, top to bottom, each with one entry per cell, left to
  right.
- `formats`: only when `opts.formats` is `true`. The same shape as `values`; each entry is the
  cell's number format as `getFormat` gives it (checkpoint 41), or `null`.

`target` is a cell or a range, checked as `setFormat` checks it: `#ADDR` (`cell` =
`String(target)`), then `#ARG` (`cell` = `target`) for more than 10,000 cells. `opts` may be left
out. Otherwise it must be a plain object (not `null`, not an array), else `#ARG` with `cell` =
`String(opts)`; and `opts.display` and `opts.formats`, where present, must be `true` or `false`,
else `#ARG` with `cell` = `"display"` or `"formats"` (`display` checked first). Other keys are
ignored. `target` is checked before `opts`.

`exportJSON` evaluates formulas exactly as `value` would (checkpoint 8 counts them), changes
nothing, is not an undo step and fires no change event.

## Values

Without `opts.display`, each entry is the cell's value as `value` gives it, written as JSON:

- A number is a JSON number with every digit `JSON.stringify` writes: `=0.1+0.2` is
  `0.30000000000000004`, not rounded as `text` rounds it (checkpoint 5), and its number format plays
  no part (`0.25` with the format `0%` is `0.25`). A number that is not finite (`=10^400`) is `null`.
- Text is a string, a boolean is `true` or `false`. Text typed into a cell stays text: an input of
  `TRUE` is the string `"TRUE"`, while `=TRUE` is `true`.
- An empty cell is `null`. A formula is never empty: one reading an empty cell gives `0`.
- An error is an object `{"error":code,"cell":cell}` with the error value's own `code` and `cell`
  (checkpoint 2), so a text that looks like an error (`#N/A` typed as text) stays a string.

With `opts.display` `true`, each entry is the string `text` gives for the cell: number formats and
the decimal comma (checkpoint 63) apply, an error is its code, an empty cell is `""`.

## Which cells

- Every cell of the range is written, including cells in hidden rows and columns (checkpoint 49).
  This is NOT what `toCSV` does, and NOT what you might expect.
- A covered cell of a merge (checkpoint 47) reads as empty: `null`, or `""` with `display`. Its
  format entry is still what `getFormat` gives.
- Nothing is trimmed: empty rows and columns at the edges of the range are written like any other.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
