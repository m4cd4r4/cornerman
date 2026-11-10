// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp57 TEXT shows a number in a format", () => {
  const s = createSheet();
  s.set("A1", "1234.567");
  s.set("B1", '=TEXT(A1, "#,##0.00")');
  s.set("B2", '=TEXT(0.25, "0%")');
  s.set("B3", '=TEXT(7, "0.000")');
  assert.equal(s.get("B1"), "1,234.57");
  assert.equal(s.get("B2"), "25%");
  assert.equal(s.get("B3"), "7.000");
});

test("cp57 the result is text", () => {
  const s = createSheet();
  s.set("A1", '=TEXT(5, "0")');
  s.set("A2", "=LEN(A1)");
  assert.equal(s.get("A1"), "5");
  assert.equal(typeof s.get("A1"), "string");
  assert.equal(s.get("A2"), 1);
});
