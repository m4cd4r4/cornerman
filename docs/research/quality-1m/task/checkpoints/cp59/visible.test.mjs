// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp59 NETWORKDAYS counts Monday to Friday, both ends included", () => {
  const s = createSheet();
  s.set("A1", "=NETWORKDAYS(DATE(2024, 1, 1), DATE(2024, 1, 7))");
  s.set("A2", "=NETWORKDAYS(DATE(2024, 1, 1), DATE(2024, 1, 31))");
  s.set("A3", "=NETWORKDAYS(DATE(2024, 1, 6), DATE(2024, 1, 6))");
  assert.equal(s.get("A1"), 5);
  assert.equal(s.get("A2"), 23);
  assert.equal(s.get("A3"), 0);
});

test("cp59 holidays come from a range", () => {
  const s = createSheet();
  s.set("B1", "=DATE(2024, 1, 1)");
  s.set("B2", "=DATE(2024, 1, 26)");
  s.set("A1", "=NETWORKDAYS(DATE(2024, 1, 1), DATE(2024, 1, 31), B1:B2)");
  assert.equal(s.get("A1"), 21);
});
