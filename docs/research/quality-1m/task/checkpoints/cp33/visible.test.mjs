// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp33 version 2 names", () => {
  const s = createSheet();
  s.setMany({ A1: "2", B1: "=A1*3" });
  assert.equal(s.value("B1"), 6);
  assert.equal(s.text("B1"), "6");
  assert.equal(s.formula("B1"), "=A1*3");
  assert.equal(s.formula("C1"), "");
  assert.deepEqual(s.addresses(), ["A1", "B1"]);
  assert.equal(s.get("B1"), 6);
  s.undo();
  assert.deepEqual(s.cells(), []);
});
