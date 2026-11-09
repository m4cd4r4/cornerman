// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

const column = (s, c, n) => Array.from({ length: n }, (_, i) => s.get(`${c}${i + 1}`));

test("cp48 sort rows by a number column", () => {
  const s = createSheet();
  s.fromCSV("pear,3\napple,1\nfig,2", "A1");
  s.sort("A1:B3", "B");
  assert.deepEqual(column(s, "A", 3), ["apple", "fig", "pear"]);
  assert.deepEqual(column(s, "B", 3), [1, 2, 3]);
});

test("cp48 sort by text, descending", () => {
  const s = createSheet();
  s.fromCSV("pear,3\napple,1\nfig,2", "A1");
  s.sort("A1:B3", "a", { descending: true });
  assert.deepEqual(column(s, "A", 3), ["pear", "fig", "apple"]);
  assert.deepEqual(column(s, "B", 3), [3, 2, 1]);
});
