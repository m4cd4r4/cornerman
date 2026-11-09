// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp41 a format changes the display, not the value", () => {
  const s = createSheet();
  s.set("A1", "1234.567");
  s.setFormat("A1", "#,##0.00");
  assert.equal(s.display("A1"), "1,234.57");
  assert.equal(s.get("A1"), 1234.567);
  assert.equal(s.getFormat("A1"), "#,##0.00");
  s.set("B1", "0.25");
  s.setFormat("B1", "0%");
  assert.equal(s.display("B1"), "25%");
  s.set("C1", "7");
  s.setFormat("C1", "0.000");
  assert.equal(s.display("C1"), "7.000");
});

test("cp41 a range gets the format, and null removes it", () => {
  const s = createSheet();
  s.set("A1", "1.5");
  s.set("B2", "2");
  s.setFormat("A1:B2", "0.0");
  assert.equal(s.display("A1"), "1.5");
  assert.equal(s.display("B2"), "2.0");
  assert.equal(s.getFormat("A2"), "0.0");
  s.setFormat("B2", null);
  assert.equal(s.getFormat("B2"), null);
  assert.equal(s.display("B2"), "2");
});
