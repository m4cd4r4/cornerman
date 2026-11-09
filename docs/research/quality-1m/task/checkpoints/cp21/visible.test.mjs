// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp21 VLOOKUP finds a row by its first column", () => {
  const s = createSheet();
  s.set("A1", "pear");
  s.set("B1", "3");
  s.set("A2", "plum");
  s.set("B2", "5");
  s.set("C1", '=VLOOKUP("plum", A1:B2, 2)');
  s.set("C2", '=VLOOKUP("fig", A1:B2, 2)');
  assert.equal(s.get("C1"), 5);
  assert.equal(s.get("C2").code, "#N/A");
});
