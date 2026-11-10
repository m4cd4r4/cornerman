// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet, createWorkbook } from "../../src/index.mjs";

test("cp63 a decimal comma changes how numbers are shown", () => {
  const s = createSheet({ decimal: "," });
  s.set("A1", "1234.5");
  s.set("A2", "=A1*2");
  assert.equal(s.display("A1"), "1234,5");
  assert.equal(s.display("A2"), "2469");
  assert.equal(s.get("A1"), 1234.5);
  s.setFormat("A1", "#,##0.00");
  assert.equal(s.display("A1"), "1.234,50");
});

test("cp63 the default is a decimal point, also in a workbook", () => {
  assert.equal(createSheet().display("A1"), "");
  const b = createWorkbook({ decimal: "," });
  const m = b.addSheet("Main");
  m.set("A1", "0.25");
  assert.equal(m.display("A1"), "0,25");
  const p = createWorkbook().addSheet("Main");
  p.set("A1", "0.25");
  assert.equal(p.display("A1"), "0.25");
});
