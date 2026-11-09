// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkbook } from "../../src/index.mjs";

test("cp55 book.undo undoes the newest change on any sheet", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  m.set("A1", "1");
  d.set("A1", "2");
  assert.equal(b.undo(), true);
  assert.equal(d.getInput("A1"), null);
  assert.equal(b.undo(), true);
  assert.equal(m.getInput("A1"), null);
  assert.equal(b.undo(), false);
  assert.equal(b.redo(), true);
  assert.equal(m.getInput("A1"), "1");
});

test("cp55 workbook name changes are undoable through the book", () => {
  const b = createWorkbook();
  b.addSheet("Main");
  b.defineConstant("K", 1);
  assert.equal(b.undo(), true);
  assert.deepEqual(b.names(), {});
  assert.equal(b.redo(), true);
  assert.deepEqual(b.names(), { K: "=1" });
});
