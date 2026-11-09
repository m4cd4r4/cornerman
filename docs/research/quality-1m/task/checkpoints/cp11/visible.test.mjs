// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp11 an unrelated formula is not evaluated again", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.set("B1", "=A1+1");
  s.set("C1", "=5+5");
  s.get("B1");
  s.get("C1");
  const n = s.stats().evaluations;
  s.set("A1", "2");
  assert.equal(s.get("C1"), 10);
  assert.equal(s.get("B1"), 3);
  assert.equal(s.stats().evaluations - n, 1);
});
