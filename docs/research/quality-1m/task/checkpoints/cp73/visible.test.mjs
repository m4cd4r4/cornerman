// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp73 an unused name and an empty reference", () => {
  const s = createSheet();
  s.set("A1", "5");
  s.defineName("total", "A1");
  s.defineName("spare", "A2");
  s.set("B1", "=TOTAL+C1");
  assert.deepEqual(s.lint(), [
    { kind: "unused-name", name: "SPARE" },
    { kind: "empty-ref", address: "B1", ref: "C1" },
  ]);
});

test("cp73 a clean sheet gives no findings", () => {
  const s = createSheet();
  s.setMany({ A1: "1", A2: "=A1*2" });
  assert.deepEqual(s.lint(), []);
});

test("cp73 setting the empty cell clears its finding", () => {
  const s = createSheet();
  s.set("A1", "=B2+1");
  assert.deepEqual(s.lint(), [{ kind: "empty-ref", address: "A1", ref: "B2" }]);
  s.set("B2", "3");
  assert.deepEqual(s.lint(), []);
});
