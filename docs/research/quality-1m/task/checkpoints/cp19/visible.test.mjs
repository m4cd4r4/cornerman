// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

function val(f) {
  const s = createSheet();
  s.set("A1", f);
  return s.get("A1");
}

test("cp19 DATE and its parts", () => {
  assert.equal(val("=DATE(2000, 1, 1)"), 1);
  assert.equal(val("=DATE(2000, 2, 1)"), 32);
  assert.equal(val("=YEAR(DATE(2024, 6, 15))"), 2024);
  assert.equal(val("=MONTH(DATE(2024, 6, 15))"), 6);
  assert.equal(val("=DAY(DATE(2024, 6, 15))"), 15);
});
