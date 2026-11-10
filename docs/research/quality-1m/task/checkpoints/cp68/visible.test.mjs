// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkbook } from "../../src/index.mjs";

test("cp68 a copied formula keeps reading the source sheet", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.set("B1", "21");
  d.set("A1", "=B1*2");
  b.copy("Data!A1", "Main!A1");
  assert.equal(m.getInput("A1"), "=Data!B1*2");
  assert.equal(m.get("A1"), 42);
});

test("cp68 values are copied as typed", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.fromCSV("x,5\ny,7", "A1");
  b.copy("Data!A1:B2", "Main!C3");
  assert.deepEqual(m.cells(), ["C3", "D3", "C4", "D4"]);
  assert.equal(m.get("D4"), 7);
});
