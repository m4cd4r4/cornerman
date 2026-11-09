// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp50 SUBTOTAL sums, averages and counts a range", () => {
  const s = createSheet();
  s.fromCSV("1\n2\n3\n4", "A1");
  s.set("B1", "=SUBTOTAL(9, A1:A4)");
  s.set("B2", "=SUBTOTAL(1, A1:A4)");
  s.set("B3", "=SUBTOTAL(2, A1:A4)");
  assert.equal(s.get("B1"), 10);
  assert.equal(s.get("B2"), 2.5);
  assert.equal(s.get("B3"), 4);
});

test("cp50 SUBTOTAL leaves out hidden rows", () => {
  const s = createSheet();
  s.fromCSV("1\n2\n3\n4", "A1");
  s.set("B1", "=SUBTOTAL(9, A1:A4)");
  s.hideRows(2);
  assert.equal(s.get("B1"), 8);
});
