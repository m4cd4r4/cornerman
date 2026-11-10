// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp77 a range as JSON values, row by row", () => {
  const s = createSheet();
  s.setMany({ A1: "1", B1: "x", A2: "=A1*2" });
  assert.equal(s.exportJSON("A1:B2"), '{"range":"A1:B2","values":[[1,"x"],[2,null]]}');
});

test("cp77 display texts and formats on request", () => {
  const s = createSheet();
  s.setMany({ A1: "0.5", B1: "3" });
  s.setFormat("A1", "0%");
  assert.equal(s.exportJSON("A1:B1", { display: true, formats: true }), '{"range":"A1:B1","values":[["50%","3"]],"formats":[["0%",null]]}');
});
