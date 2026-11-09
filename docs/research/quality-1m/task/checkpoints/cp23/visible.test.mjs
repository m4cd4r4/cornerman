// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp23 inserting a row moves cells and rewrites formulas", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.set("A2", "2");
  s.set("A3", "3");
  s.set("B1", "=SUM(A1:A3)");
  s.insertRows(2);
  assert.deepEqual(s.cells(), ["A1", "B1", "A3", "A4"]);
  assert.equal(s.getInput("B1"), "=SUM(A1:A4)");
  assert.equal(s.get("B1"), 6);
  assert.equal(s.get("A2"), null);
});
