// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkbook } from "../../src/index.mjs";

test("cp37 renaming a sheet rewrites the formulas that name it", () => {
  const book = createWorkbook();
  const main = book.addSheet("Main");
  const data = book.addSheet("Data");
  data.set("A1", "5");
  main.set("A1", "=data!A1*2");
  assert.equal(book.renameSheet("Data", "Facts"), undefined);
  assert.deepEqual(book.sheetNames(), ["Main", "Facts"]);
  assert.equal(book.sheet("facts"), data);
  assert.equal(main.getInput("A1"), "=Facts!A1*2");
  assert.equal(main.get("A1"), 10);
  assert.equal(main.undo(), false);
});
