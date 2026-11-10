# Checkpoint 79: cell styles

Cells can now carry a style: bold, italic, a text colour and a fill colour. A style changes no value
and no displayed text; it travels with copies and fills as number formats do (checkpoint 41).

## API

- `sheet.setStyle(target, style)`: changes the style of every cell in `target`, a cell or a range
  checked as `setFormat` checks it (`#ADDR` with `cell` = `String(target)`, then `#ARG` for more
  than 10,000 cells). Returns `undefined`.
- `sheet.getStyle(address)`: a new object holding the cell's style, with its keys in the order
  `bold`, `italic`, `color`, `fill` (only the keys the cell has), or `null` for a cell with no
  style. An invalid address throws `#ADDR` as `getFormat` does.

## The style argument

- `style` is `null`, which removes the whole style of every cell in `target`, or a plain object
  whose keys are some of:
  - `bold`, `italic`: `true`, `false` or `null`;
  - `color` (the text colour), `fill` (the background): a `#` and six hex digits in any case
    (`"#ff8800"`), kept in upper case (`"#FF8800"`), or `null`.
- Anything else for `style` (an array, a string, a number) is `#ARG` with `cell` = `String(style)`.
  An unknown key or a value not allowed for its key is `#ARG` with `cell` = that key, the first
  such key in the order `Object.keys` gives. These checks come after the target's, and a failure
  changes nothing.
- The keys given are merged into each cell's style: they replace the same keys there, a key set to
  `null` is removed, and keys not given stay. `setStyle("A1", { bold: true })` then
  `setStyle("A1", { color: "#FF0000" })` leaves `{ bold: true, color: "#FF0000" }`. This is NOT
  what you might expect (`setFormat` replaces). A cell left with no keys has no style, and `{}`
  changes nothing. `false` is kept as a value: `{ bold: false }` is a style.
- One undo step for the whole target (labelled `"setStyle"`, checkpoint 76), none when no cell's
  style changes.

## Styles and other features

- `copy` (checkpoint 26) and `book.copy` (checkpoint 68) give each target cell its source cell's
  whole style, as they do with formats: the source's style replaces the target's, it is not merged,
  and a source with no style (an empty cell included) removes the target's. Part of the same undo
  step as the copy.
- `fillDown` and `fillRight` (checkpoint 64) give each cell they write the style of its line's
  first cell, exactly where they give its format.
- `sort` (checkpoint 48) leaves styles where they are, as it leaves notes: the inputs and formats
  move, the styles stay with the cells. This is NOT what you might expect.
- Inserted rows and columns have no style, and a style in a deleted row or column is gone; other
  styles move with their cells (checkpoints 23 to 25). This is NOT what Excel does (Excel gives an
  inserted row the formatting of the row above). Undoing an insert or delete puts every style back.
- `clear` (checkpoint 75), `replace` (checkpoint 51) and writing inputs leave styles alone.
  Protected cells (checkpoint 71) and covered cells of a merge (checkpoint 47) can be styled.
- Styles are not values: `value`, `text`, `toCSV`, `exportJSON` and the rest give what they gave
  before, and a style change fires no change event (checkpoint 65).
- Styles are not saved: `save()` and `book.save()` write no trace of them (a sheet whose only extra
  is styles still saves as version 2, checkpoint 56), and a loaded sheet has none. A batch that
  rolls back (checkpoint 66) puts styles back as they were.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
