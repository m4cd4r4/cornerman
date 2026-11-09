// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp06 comparisons return booleans", () => {
  const s = createSheet();
  s.set("A1", "=1<2");
  s.set("A2", "=3=4");
  assert.equal(s.get("A1"), true);
  assert.equal(s.get("A2"), false);
  assert.equal(s.display("A1"), "TRUE");
});

test("cp06 concatenation", () => {
  const s = createSheet();
  s.set("A1", "ab");
  s.set("B1", "=A1&1+1");
  assert.equal(s.get("B1"), "ab2");
});
