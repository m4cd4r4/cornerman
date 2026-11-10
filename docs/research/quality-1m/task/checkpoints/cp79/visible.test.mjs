// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp79 setStyle and getStyle", () => {
  const s = createSheet();
  s.setStyle("A1:B1", { bold: true, fill: "#ffee00" });
  assert.deepEqual(s.getStyle("A1"), { bold: true, fill: "#FFEE00" });
  assert.deepEqual(s.getStyle("B1"), { bold: true, fill: "#FFEE00" });
  assert.equal(s.getStyle("C1"), null);
  s.setStyle("A1", null);
  assert.equal(s.getStyle("A1"), null);
});

test("cp79 copy carries the style", () => {
  const s = createSheet();
  s.setCell("A1", "1");
  s.setStyle("A1", { italic: true });
  s.copy("A1", "C3");
  assert.deepEqual(s.getStyle("C3"), { italic: true });
  assert.equal(s.formula("C3"), "1");
});
