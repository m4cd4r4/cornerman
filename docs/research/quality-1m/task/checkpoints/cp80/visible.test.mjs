// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { apiIndex } from "../../src/index.mjs";

test("cp80 apiIndex lists the exports", () => {
  assert.deepEqual(apiIndex().exports, ["apiIndex", "createSheet", "createWorkbook", "diffWorkbooks", "loadSheet", "loadWorkbook"]);
});

test("cp80 the sheet and workbook lists are sorted and hold old and new names", () => {
  const { sheet, workbook } = apiIndex();
  assert.deepEqual(sheet, [...sheet].sort());
  assert.deepEqual(workbook, [...workbook].sort());
  for (const n of ["set", "setCell", "get", "value", "lint", "exportJSON"]) assert.ok(sheet.includes(n), n);
  for (const n of ["sheet", "get", "batch", "renameName"]) assert.ok(workbook.includes(n), n);
});
