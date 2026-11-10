# Checkpoint 67: formula limits

A formula you type may now be at most so long and so deeply nested. Inputs that break a limit are
refused before anything is written.

## The limits

An input is a formula when it starts with `=`. Other inputs (text, numbers, `""`) have no limit,
however long.

1. **Length.** A formula input holds at most 1,000 characters, counting the leading `=` and every
   space, as JavaScript's `length` counts them. A formula of 1,000 characters is accepted; 1,001 is
   refused. This is NOT what Excel does (Excel allows 8,192 characters, not counting the `=`).
2. **Nesting.** Read the input from left to right and count the parentheses open at each point. At
   most 16 may be open at once. Grouping parentheses count exactly as the parentheses of a function
   call do: `=((((1))))` and `=SUM(MAX(MIN((1))))` both nest 4 deep, and `=SUM((1))` 2 deep. This is
   NOT what Excel does (Excel counts only nested function calls, up to 64).
   - A `"` starts a string literal, which runs to the next `"`; parentheses inside it do not count.
     A doubled `""` inside a string is a quote character and does not end it. A string that is never
     closed runs to the end of the input.
   - A `)` with no `(` open before it is ignored.
   - Nesting is counted on the text, so a formula that does not parse is checked too: an input of
     `=` followed by 17 `(` is refused, not stored as `#PARSE!` (checkpoint 2).

Length is checked before nesting.

## Which methods check

The limits are checked by the methods that check validation rules (checkpoint 46): `set`,
`setCell`, `setMany`, `fromCSV`, `fillDown` and `fillRight` (checkpoint 64) and `replace`
(checkpoint 51). They check every input they would write before writing any, cell by cell in the
order checkpoints 46 and 64 give (for `replace`, row-major), and at the first input refused throw
`#LIMIT` with `cell` = that address in upper case, writing nothing. As with validation, an input
is checked even when the cell already holds it. For each cell, a merge
(`#MERGE`, checkpoint 47) is checked first, then the limits, then its validation rule
(`#INVALID`).

The limits are on what is typed, not on what is stored. `copy`, `sort`, insert and delete of rows
and columns, `book.renameSheet`, `book.deleteSheet`, undo and redo, `loadSheet` and `loadWorkbook`
never check them: a formula they write or load is kept even when it is longer or deeper than the
limits, and it evaluates as usual. So when `A1` holds a 1,000-character formula reading `B9`,
`copy("A1", "A2")` writes a 1,001-character formula reading `B10`, while `fillDown("A1:A2")` throws
`#LIMIT` with `cell` `"A2"`. This is NOT what you might expect.

## Errors

| Check | `code` | `cell` |
| --- | --- | --- |
| a formula input holds at most 1,000 characters | `#LIMIT` | the address |
| at most 16 parentheses are open at once | `#LIMIT` | the address |

The error's `message` says which limit was broken.

Add a line for this checkpoint to CHANGES.md, as in checkpoint 40.
