// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp25 inserting and deleting columns", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.set("B1", "2");
  s.set("C1", "3");
  s.set("A2", "=SUM(A1:C1)");
  s.insertCols("B");
  assert.deepEqual(s.cells(), ["A1", "C1", "D1", "A2"]);
  assert.equal(s.getInput("A2"), "=SUM(A1:D1)");
  s.deleteCols("C");
  assert.equal(s.getInput("A2"), "=SUM(A1:C1)");
  assert.equal(s.get("A2"), 4);
});
