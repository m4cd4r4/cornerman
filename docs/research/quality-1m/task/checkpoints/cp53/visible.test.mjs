// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkbook } from "../../src/index.mjs";

test("cp53 a workbook name works on every sheet", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.set("A1", "4");
  d.set("A2", "6");
  assert.equal(b.defineName("total", "Data!A1:A2"), undefined);
  m.set("A1", "=SUM(TOTAL)");
  d.set("B1", "=SUM(total)");
  assert.equal(m.get("A1"), 10);
  assert.equal(d.get("B1"), 10);
  assert.deepEqual(b.names(), { TOTAL: "Data!A1:A2" });
});

test("cp53 a sheet's own name comes first", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  b.defineConstant("RATE", 2);
  m.defineConstant("RATE", 3);
  m.set("A1", "=RATE");
  assert.equal(m.get("A1"), 3);
  m.removeName("RATE");
  assert.equal(m.get("A1"), 2);
});
