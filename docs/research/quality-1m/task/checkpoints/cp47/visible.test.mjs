// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp47 merge and unmerge", () => {
  const s = createSheet();
  s.set("A1", "Title");
  s.merge("A1:C1");
  assert.deepEqual(s.merges(), ["A1:C1"]);
  assert.equal(s.get("A1"), "Title");
  assert.equal(s.unmerge("B1"), true);
  assert.deepEqual(s.merges(), []);
  assert.equal(s.unmerge("B1"), false);
});

test("cp47 covered cells read as empty", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.set("A2", "2");
  s.set("B1", "=A1+A2");
  s.merge("A1:A2");
  assert.equal(s.get("A2"), null);
  assert.equal(s.get("B1"), 1);
});
