// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp42 set, read and list notes", () => {
  const s = createSheet();
  s.set("A1", "10");
  s.setNote("A1", "checked by Ann");
  s.setNote("c2", "source: survey");
  assert.equal(s.getNote("A1"), "checked by Ann");
  assert.equal(s.getNote("C2"), "source: survey");
  assert.equal(s.getNote("B1"), null);
  assert.deepEqual(s.notes(), { A1: "checked by Ann", C2: "source: survey" });
  assert.equal(s.get("A1"), 10);
});

test("cp42 an empty text removes the note", () => {
  const s = createSheet();
  s.setNote("B2", "temporary");
  s.setNote("B2", "");
  assert.equal(s.getNote("B2"), null);
  assert.deepEqual(s.notes(), {});
});
