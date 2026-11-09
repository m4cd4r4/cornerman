# Checkpoint 6: comparison, booleans, concatenation

## Operators and precedence

Add, from lowest precedence (below everything in checkpoint 2):

1. Comparisons `=`, `<>`, `<`, `>`, `<=`, `>=`, left-associative. The result is a JavaScript
   boolean (`true` / `false`).
2. Concatenation `&`, left-associative, above comparisons and below `+` / `-`.

So `=1+1&1` is `"21"` and `=1&2=12` compares the text `"12"` with the number 12.

## Booleans

- A cell can now hold a boolean as a formula result. `display` shows `"TRUE"` or `"FALSE"`.
- In arithmetic, `true` is 1 and `false` is 0.

## Comparison rules

- Number with number: by value.
- Text with text: case-insensitive (`"abc"` equals `"ABC"`).
- Mixed types order as: every number < every text < every boolean, regardless of the values.
  `false < true`.
- An empty cell compares as `0` against a number, as `""` against text, and as `false` against a
  boolean.

## Concatenation

- Each operand becomes its `display` text (checkpoint 5 rules, so `0.1+0.2` concatenates as
  `"0.3"`), booleans as `"TRUE"` / `"FALSE"`, empty as `""`. The result is text.

Errors propagate through comparisons and `&` under the checkpoint 4 rules.
