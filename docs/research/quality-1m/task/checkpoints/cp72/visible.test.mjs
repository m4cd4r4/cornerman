// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp72 every error cell is listed with its code and cell", () => {
  const s = createSheet();
  s.setMany({ A1: "=1/0", B1: "=A1+1", C1: "5" });
  assert.deepEqual(s.errorCells(), [
    { address: "A1", code: "#DIV/0!", cell: "A1" },
    { address: "B1", code: "#DIV/0!", cell: "A1" },
  ]);
});

test("cp72 a sheet with no errors gives an empty list", () => {
  const s = createSheet();
  s.setMany({ A1: "1", B1: "=A1*2" });
  assert.deepEqual(s.errorCells(), []);
});
