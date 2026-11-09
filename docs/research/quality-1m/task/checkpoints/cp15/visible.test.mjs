// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp15 AVERAGE, MIN, MAX, COUNT over a range", () => {
  const s = createSheet();
  s.set("A1", "2");
  s.set("A2", "4");
  s.set("A3", "x");
  s.set("B1", "=AVERAGE(A1:A3)");
  s.set("B2", "=MIN(A1:A3)");
  s.set("B3", "=MAX(A1:A3)");
  s.set("B4", "=COUNT(A1:A3)");
  assert.deepEqual(["B1", "B2", "B3", "B4"].map((c) => s.get(c)), [3, 2, 4, 2]);
});
