You are building a spreadsheet engine in this repository, one checkpoint at a time.

How the work runs:
- Run `node gate.mjs next` to get the first checkpoint. It prints the spec and writes that
  checkpoint's visible tests into `test/visible/`.
- Implement it in `src/`. Run `npm test` until everything passes.
- Commit, then run `node gate.mjs next` again. The gate refuses while any visible test fails.
- Keep going until the gate prints ALL DONE. Do not stop early, do not ask questions: decide,
  and carry on. Every checkpoint must keep all earlier behaviour working.
- Tick each checkpoint in FEATURES.md when it is done.
