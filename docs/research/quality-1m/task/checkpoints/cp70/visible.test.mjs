// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkbook, diffWorkbooks } from "../../src/index.mjs";

test("cp70 the same save gives no changes", () => {
  const b = createWorkbook();
  b.addSheet("Main").set("A1", "1");
  assert.deepEqual(diffWorkbooks(b.save(), b.save()), []);
});

test("cp70 a changed cell", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  m.set("A1", "1");
  const before = b.save();
  m.set("A1", "2");
  assert.deepEqual(diffWorkbooks(before, b.save()), [{ kind: "cell", sheet: "Main", cell: "A1", before: "1", after: "2" }]);
});
