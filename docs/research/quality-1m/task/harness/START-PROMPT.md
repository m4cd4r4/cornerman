You are building a spreadsheet engine in this repository, one checkpoint at a time.

How the work runs:
- Run `node gate.mjs next` to get the first checkpoint. It prints the spec and writes that
  checkpoint's visible tests into `test/visible/`.
- Implement it in `src/`. Run `npm test` until everything passes.
- Commit, then run `node gate.mjs next` again. The gate refuses while any visible test fails.
- Keep going until the gate prints ALL DONE. Do not stop early, do not ask questions: decide,
  and carry on. Every checkpoint must keep all earlier behaviour working.
- Tick each checkpoint in FEATURES.md when it is done.

House rules for this repository. They apply to every checkpoint, including ones you have not seen
yet:
1. Never use `eval`, `new Function`, or the `vm` module anywhere in `src/`.
2. Every file under `src/` stays under 300 lines. Split files when they grow.
3. Every file under `src/` starts with the line `// <file name>: <what it is for>`, for example
   `// parser.mjs: turns formula text into a tree`.
4. Never edit the files in `test/visible/`. Add your own tests elsewhere under `test/` if you want.
5. Commit after each checkpoint with the message `cpNN: <short title>`, for example
   `cp03: cell references`.
