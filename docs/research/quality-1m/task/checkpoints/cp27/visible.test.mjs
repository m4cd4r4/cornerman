// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp27 undo and redo a set", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.set("A1", "2");
  assert.equal(s.undo(), true);
  assert.equal(s.get("A1"), 1);
  assert.equal(s.undo(), true);
  assert.equal(s.getInput("A1"), null);
  assert.equal(s.undo(), false);
  assert.equal(s.redo(), true);
  assert.equal(s.get("A1"), 1);
});
