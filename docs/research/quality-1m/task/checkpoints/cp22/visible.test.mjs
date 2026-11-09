// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp22 SUMIF with and without a sum range", () => {
  const s = createSheet();
  s.set("A1", "tea");
  s.set("B1", "4");
  s.set("A2", "cake");
  s.set("B2", "6");
  s.set("A3", "tea");
  s.set("B3", "5");
  s.set("C1", '=SUMIF(A1:A3, "tea", B1:B3)');
  s.set("C2", '=SUMIF(B1:B3, ">4")');
  assert.equal(s.get("C1"), 9);
  assert.equal(s.get("C2"), 11);
});
