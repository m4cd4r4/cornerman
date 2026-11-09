// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp12 recalc order from the spec example", () => {
  const s = createSheet();
  s.set("A1", "=C1");
  s.set("B1", "=1");
  s.set("C1", "=1");
  assert.deepEqual(s.recalc(), ["B1", "C1", "A1"]);
  assert.deepEqual(s.recalc(), []);
});
