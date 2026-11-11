House rules for this repository. They apply to every checkpoint, including ones you have not seen
yet. They are printed here once and will not be shown again:
1. Never use `eval`, `new Function`, or the `vm` module anywhere in `src/`.
2. Every file under `src/` stays under 300 lines. Split files when they grow.
3. Every file under `src/` starts with the line `// <file name>: <what it is for>`, for example
   `// parser.mjs: turns formula text into a tree`.
4. Never edit the files in `test/visible/`. Add your own tests elsewhere under `test/` if you want.
5. Commit after each checkpoint with the message `cpNN: <short title>`, for example
   `cp03: cell references`.
