// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp49 hide and show rows and columns", () => {
  const s = createSheet();
  assert.equal(s.hideRows(2, 2), undefined);
  s.hideCols("c");
  assert.deepEqual(s.hiddenRows(), [2, 3]);
  assert.deepEqual(s.hiddenCols(), ["C"]);
  s.showRows(3);
  assert.deepEqual(s.hiddenRows(), [2]);
  s.showCols("C");
  assert.deepEqual(s.hiddenCols(), []);
});

test("cp49 hidden cells keep their values", () => {
  const s = createSheet();
  s.set("A2", "5");
  s.set("A3", "=A2*2");
  s.hideRows(2);
  assert.equal(s.get("A2"), 5);
  assert.equal(s.get("A3"), 10);
  assert.equal(s.display("A2"), "5");
});
