# Checkpoint 64: fill down and fill right

## API

- `sheet.fillDown(target)`: in each column of `target`, the cells below the top one are filled from
  it. Returns `undefined`.
- `sheet.fillRight(target)`: in each row of `target`, the cells right of the left-most one are
  filled from it. Returns `undefined`.
- `target` is one address or a range of two addresses joined by `:`, corners in any order, as for
  `setFormat` (checkpoint 41). A column (for `fillDown`) or a row (for `fillRight`) of the target is
  called a line below; its first cell is the top or left-most one.

## What a line gets

Each line is filled on its own, in one of two ways:

1. **A series**, when the first two cells of the line both hold numbers typed as inputs (inputs that
   match the checkpoint 1 number grammar, such as `5`, `-2.5` or `007`; a formula or text is not
   one). The first two cells are left as they are, and the cell at position `i` (the first cell is
   0) gets the number `first + i * (second - first)`, worked out in floating point and then rounded
   half to even to 10 decimal places on the shortest decimal form, as `ROUND` does (checkpoint 16).
   It is written as an input: the shortest number text, no exponent, `-` only when negative. With
   `0.1` and `0.2`, the next cells get `0.3`, `0.4`, `0.5`. A line of two cells is left as it is.
   This is NOT what Excel does (Excel's fill down always copies the first cell; only its fill
   handle makes a series).
2. **A copy** otherwise. Every other cell of the line gets the first cell's input, exactly as
   `copy` (checkpoint 26) would write it there: a formula's references move by the offset from the
   first cell (parts marked `$` stay, a reference with a sheet name moves too, and one moved off the
   sheet becomes `#REF!`), and any other input is copied exactly. An empty first cell clears the
   others. Text is never counted up: `Item 1` fills as `Item 1`, and a single number as the same
   number. This is NOT what Excel does (Excel's fill handle turns `Item 1` into `Item 2`).

So with `A1` = `1`, `A2` = `x`, `fillDown("A1:A3")` writes `1` into `A2` and `A3`.

## Everything else a fill does

- Every cell the fill writes gets the format (checkpoint 41) of its line's first cell; when that
  cell has none, the written cell's format is removed. In a series the second cell keeps its own.
- Notes (checkpoint 42) and validation rules (checkpoint 46) stay where they are and are not filled.
- A fill writes as `set` does, so validation is checked: every written input is checked against
  its cell's rule, even one that does not change, and the first refusal, in row-major order over
  the written cells, throws `#INVALID` (`cell` = that cell), writing nothing. This is NOT what you
  might expect (`copy` checks no rules).
- Hidden rows and columns (checkpoint 49) are filled like any other, and count as positions in a
  series.
- One fill is one undo step (checkpoint 27), inputs and formats together, and on the workbook's
  list (checkpoint 55) like any sheet step. A fill that changes no input and no format is not
  recorded. Each written cell then behaves as if `set` had been called on it.
- Defined names are never changed by a fill.

## Errors

`fillDown` and `fillRight` check, in this order, and throw at the first failure, changing nothing:

| Check | `code` | `cell` |
| --- | --- | --- |
| `target` is an address or a range as above | `#ADDR` | `String(target)` |
| `target` holds at most 10,000 cells | `#ARG` | `target` |
| no merged range (checkpoint 47) shares a cell with `target` | `#MERGE` | `target` |
| every written input passes its cell's rule | `#INVALID` | the cell |

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
