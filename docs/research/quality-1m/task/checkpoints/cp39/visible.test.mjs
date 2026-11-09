// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp39 explain shows where a value comes from", () => {
  const s = createSheet();
  s.set("A1", "=B1+C1");
  s.set("B1", "=C1*2");
  s.set("C1", "3");
  assert.deepEqual(s.explain("a1"), {
    address: "A1",
    input: "=B1+C1",
    value: 9,
    from: [
      { address: "B1", input: "=C1*2", value: 6, from: [{ address: "C1", input: "3", value: 3, from: [] }] },
      { address: "C1", input: "3", value: 3, from: null },
    ],
  });
});
