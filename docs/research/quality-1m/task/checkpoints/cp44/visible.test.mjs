// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

function sheet() {
  const s = createSheet();
  s.fromCSV("10,ant,x\n20,bee,y\n30,cat,z", "A1");
  return s;
}

test("cp44 INDEX reads a cell by row and column", () => {
  const s = sheet();
  s.set("E1", "=INDEX(A1:C3, 2, 3)");
  s.set("E2", "=INDEX(A1:A3, 3)");
  assert.equal(s.get("E1"), "y");
  assert.equal(s.get("E2"), 30);
});

test("cp44 MATCH finds an exact position", () => {
  const s = sheet();
  s.set("E1", '=MATCH("cat", B1:B3, 0)');
  s.set("E2", '=INDEX(A1:A3, MATCH("bee", B1:B3, 0))');
  assert.equal(s.get("E1"), 3);
  assert.equal(s.get("E2"), 20);
});
