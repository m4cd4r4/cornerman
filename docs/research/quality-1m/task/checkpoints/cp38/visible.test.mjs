// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp38 canonical formula text", () => {
  const s = createSheet();
  s.set("B1", "2");
  s.set("A1", "= sum( b1 , 1 ) * (2 + 3.50)");
  assert.equal(s.canonical("A1"), "=SUM(B1,1)*(2+3.5)");
  s.set("A2", "=(1-2)-3");
  assert.equal(s.canonical("A2"), "=1-2-3");
  assert.equal(s.canonical("C1"), "");
  s.set("A3", "hello");
  assert.equal(s.canonical("A3"), "hello");
});
