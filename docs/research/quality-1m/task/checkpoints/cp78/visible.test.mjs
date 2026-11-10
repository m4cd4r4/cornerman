// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet, createWorkbook } from "../../src/index.mjs";

test("cp78 renameName keeps the target and rewrites the formulas", () => {
  const s = createSheet();
  s.setMany({ A1: "5", B1: "=TOTAL*2", B2: "=total+1" });
  s.defineName("total", "A1");
  assert.equal(s.renameName("TOTAL", "Sum1x"), 2);
  assert.equal(s.formula("B1"), "=Sum1x*2");
  assert.equal(s.formula("B2"), "=Sum1x+1");
  assert.deepEqual(s.names(), { SUM1X: "A1" });
  assert.equal(s.value("B1"), 10);
});

test("cp78 a workbook name is renamed on every sheet", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.setCell("A1", "3");
  b.defineConstant("K", 4);
  m.setCell("A1", "=K");
  d.setCell("B1", "=K+A1");
  assert.equal(b.renameName("K", "Rate"), 2);
  assert.equal(m.formula("A1"), "=Rate");
  assert.equal(d.value("B1"), 7);
  assert.deepEqual(b.names(), { RATE: "=4" });
});
