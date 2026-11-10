// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet, createWorkbook } from "../../src/index.mjs";

test("cp76 undoList names the steps, newest first; undo moves them to redoList", () => {
  const s = createSheet();
  s.setCell("A1", "1");
  s.setMany({ A2: "2", A3: "3" });
  s.insertRows(1);
  assert.deepEqual(s.undoList(), ["insertRows", "setMany", "setCell"]);
  assert.deepEqual(s.redoList(), []);
  s.undo();
  assert.deepEqual(s.undoList(), ["setMany", "setCell"]);
  assert.deepEqual(s.redoList(), ["insertRows"]);
});

test("cp76 a workbook lists steps of every sheet with the sheet name", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  m.setCell("A1", "1");
  d.setFormat("A1", "0.00");
  assert.deepEqual(b.undoList(), [{ sheet: "Data", label: "setFormat" }, { sheet: "Main", label: "setCell" }]);
});
