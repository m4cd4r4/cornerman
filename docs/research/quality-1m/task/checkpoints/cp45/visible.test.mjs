// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp45 SUMPRODUCT of two columns", () => {
  const s = createSheet();
  s.fromCSV("2,10\n3,20\n4,30", "A1");
  s.set("C1", "=SUMPRODUCT(A1:A3, B1:B3)");
  assert.equal(s.get("C1"), 200);
});

test("cp45 SUMPRODUCT of one and of three ranges", () => {
  const s = createSheet();
  s.fromCSV("1,2,3\n4,5,6", "A1");
  s.set("E1", "=SUMPRODUCT(A1:A2)");
  s.set("E2", "=SUMPRODUCT(A1:A2, B1:B2, C1:C2)");
  assert.equal(s.get("E1"), 5);
  assert.equal(s.get("E2"), 126);
});
