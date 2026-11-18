# seed7-chain

From the cornerman evaluation, Test 1 trial `t1-cm-sonnet-s7-c3` (2026-11-17), the seed whose last
handover dropped every standing rule (cm missed 21 of 24 facts).

- `h1.md`, `h2.md`, `h3.md`: the three handovers as the model wrote them. The sections saving adds
  ("Rulings from the user", "Recent trail", "Carried forward from the previous handover") are cut, so
  a replay regenerates them with the code under test.
- `s1.jsonl`, `s2.jsonl`, `s3.jsonl`: the rulings log of the session that saved each handover, as the
  UserPromptSubmit hook recorded it. Session ids replaced by s1-s3.

The fourth session loaded h3; its context is what `test/carry-forward-seed7.test.mjs` checks.
Paths inside (`/work`, the npm docs) are the eval container's, not a real machine's.
