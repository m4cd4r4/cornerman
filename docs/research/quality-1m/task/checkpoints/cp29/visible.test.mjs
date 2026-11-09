// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp29 importing values and formulas", () => {
  const s = createSheet();
  s.fromCSV('Item,Cost\n"Tea, green",=2+3\n');
  assert.equal(s.getInput("A2"), "Tea, green");
  assert.equal(s.get("B2"), 5);
  assert.equal(s.toCSV(), 'Item,Cost\n"Tea, green",5');
});
