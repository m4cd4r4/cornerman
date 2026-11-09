// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp03 references and updates", () => {
  const s = createSheet();
  s.set("A1", "2");
  s.set("B1", "=A1*10");
  assert.equal(s.get("B1"), 20);
  s.set("A1", "3");
  assert.equal(s.get("B1"), 30);
});

test("cp03 empty reads as 0", () => {
  const s = createSheet();
  s.set("A1", "=Z9+1");
  assert.equal(s.get("A1"), 1);
});
