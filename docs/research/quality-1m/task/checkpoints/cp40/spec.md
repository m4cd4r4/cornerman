# Checkpoint 40: change log

Nothing new in the API. Write a change log: a file that tells a reader of the code what each of the
40 checkpoints added or changed.

## The file

- It is `CHANGES.md` in the repository root, beside `src/`, in UTF-8. Lines may end in `\n` or
  `\r\n`.
- Blank lines, and lines starting with `#`, are ignored. Every other line is an entry.
- An entry is `- cpNN: ` followed by its text, where `NN` is the checkpoint number in two digits.

## The entries

- There are exactly 40, for `cp01` to `cp40`, in that order, each once.
- Each text is 1 to 120 characters long and does not start or end with a space.
- Each text says what that checkpoint added or changed, in words a user of the API can follow. A
  text that equals the checkpoint's title in `FEATURES.md`, ignoring case, fails this rule.
- No two entries have the same text, ignoring case.

Every rule of checkpoints 1 to 39 still holds.
