// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp69 a semicolon delimiter", () => {
  const s = createSheet();
  assert.equal(s.fromCSV("a;b\n1;2", "A1", { delimiter: ";" }), undefined);
  assert.deepEqual(s.cells(), ["A1", "B1", "A2", "B2"]);
  assert.equal(s.get("B2"), 2);
});

test("cp69 a header record is returned and not written", () => {
  const s = createSheet();
  assert.deepEqual(s.fromCSV("name,qty\npen,3", "B2", { header: true }), ["name", "qty"]);
  assert.equal(s.getInput("B2"), "pen");
  assert.equal(s.get("C2"), 3);
  assert.equal(s.getInput("B3"), null);
});
