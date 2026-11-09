// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp13 SUM over a range", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.set("A2", "2");
  s.set("A3", "3");
  s.set("B1", "=SUM(A1:A3)");
  assert.equal(s.get("B1"), 6);
});

test("cp13 a range outside a function is #VALUE!", () => {
  const s = createSheet();
  s.set("B1", "=A1:A3");
  assert.equal(s.get("B1").code, "#VALUE!");
});
