// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp24 deleting a row shrinks ranges and breaks references into it", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.set("A2", "2");
  s.set("A3", "3");
  s.set("B1", "=SUM(A1:A3)");
  s.set("C1", "=A2*10");
  s.deleteRows(2);
  assert.deepEqual(s.cells(), ["A1", "B1", "C1", "A2"]);
  assert.equal(s.getInput("B1"), "=SUM(A1:A2)");
  assert.equal(s.get("B1"), 4);
  assert.equal(s.getInput("C1"), "=#REF!*10");
  assert.equal(s.get("C1").code, "#REF!");
});
