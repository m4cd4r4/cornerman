// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

function sheet() {
  const s = createSheet();
  s.set("A1", "tea");
  s.set("B1", "4");
  s.set("A2", "cake");
  s.set("B2", "6");
  s.set("A3", "tea");
  s.set("B3", "5");
  return s;
}

test("cp43 COUNTIF counts the cells that meet a criterion", () => {
  const s = sheet();
  s.set("C1", '=COUNTIF(A1:A3, "tea")');
  s.set("C2", '=COUNTIF(B1:B3, ">4")');
  assert.equal(s.get("C1"), 2);
  assert.equal(s.get("C2"), 2);
});

test("cp43 AVERAGEIF with and without an average range", () => {
  const s = sheet();
  s.set("C1", '=AVERAGEIF(A1:A3, "tea", B1:B3)');
  s.set("C2", '=AVERAGEIF(B1:B3, "<6")');
  assert.equal(s.get("C1"), 4.5);
  assert.equal(s.get("C2"), 4.5);
});
