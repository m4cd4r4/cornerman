// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

function val(f) {
  const s = createSheet();
  s.set("A1", f);
  return s.get("A1");
}

test("cp58 EDATE and EOMONTH move by months", () => {
  assert.equal(val("=EDATE(DATE(2024, 1, 15), 1) = DATE(2024, 2, 15)"), true);
  assert.equal(val("=EDATE(DATE(2024, 3, 15), -3) = DATE(2023, 12, 15)"), true);
  assert.equal(val("=EOMONTH(DATE(2024, 1, 15), 0) = DATE(2024, 1, 31)"), true);
  assert.equal(val("=EOMONTH(DATE(2024, 1, 15), 1) = DATE(2024, 2, 29)"), true);
});

test("cp58 WEEKDAY gives the day of the week", () => {
  assert.equal(val("=WEEKDAY(DATE(2024, 1, 1), 2)"), 1);
  assert.equal(val("=WEEKDAY(DATE(2024, 1, 7), 2)"), 7);
  assert.equal(val("=WEEKDAY(DATE(2024, 1, 7), 1)"), 1);
});
