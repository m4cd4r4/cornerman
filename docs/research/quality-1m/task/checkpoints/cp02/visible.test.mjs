// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp02 arithmetic", () => {
  const s = createSheet();
  s.set("A1", "=1+2*3");
  assert.equal(s.get("A1"), 7);
  s.set("A2", "=(1+2)*3");
  assert.equal(s.get("A2"), 9);
  assert.equal(s.getInput("A2"), "=(1+2)*3");
});

test("cp02 division by zero is an error value", () => {
  const s = createSheet();
  s.set("B1", "=1/0");
  const v = s.get("B1");
  assert.equal(v.code, "#DIV/0!");
  assert.equal(v.cell, "B1");
});
