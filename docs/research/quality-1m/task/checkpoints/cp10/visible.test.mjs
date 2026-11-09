// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp10 direct precedents and dependents", () => {
  const s = createSheet();
  s.set("C1", "=B1+A1");
  assert.deepEqual(s.precedents("C1"), ["A1", "B1"]);
  assert.deepEqual(s.dependents("A1"), ["C1"]);
});

test("cp10 transitive precedents", () => {
  const s = createSheet();
  s.set("A1", "=B1");
  s.set("B1", "=C1");
  assert.deepEqual(s.precedents("A1", { transitive: true }), ["B1", "C1"]);
});
