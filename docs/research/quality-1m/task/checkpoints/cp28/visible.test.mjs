// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp28 exporting values and formulas", () => {
  const s = createSheet();
  s.set("A1", "Item");
  s.set("B1", "Cost");
  s.set("A2", "Tea, green");
  s.set("B2", "=2+3");
  assert.equal(s.toCSV(), 'Item,Cost\n"Tea, green",5');
  assert.equal(s.toCSV({ formulas: true }), 'Item,Cost\n"Tea, green",=2+3');
});
