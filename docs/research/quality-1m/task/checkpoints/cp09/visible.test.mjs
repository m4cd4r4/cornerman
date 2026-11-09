// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp09 a self-reference is #CYCLE!", () => {
  const s = createSheet();
  s.set("A1", "=A1+1");
  assert.equal(s.get("A1").code, "#CYCLE!");
  assert.equal(s.get("A1").cell, "A1");
});

test("cp09 breaking a two-cell cycle restores values", () => {
  const s = createSheet();
  s.set("A1", "=B1");
  s.set("B1", "=A1");
  assert.equal(s.get("B1").code, "#CYCLE!");
  s.set("B1", "4");
  assert.equal(s.get("A1"), 4);
});
