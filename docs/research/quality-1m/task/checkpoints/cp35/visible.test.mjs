// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkbook, loadWorkbook } from "../../src/index.mjs";

test("cp35 a workbook saves and loads", () => {
  const book = createWorkbook();
  book.addSheet("Main").set("A1", "=Data!A1*2");
  book.addSheet("Data").set("A1", "5");
  const text = book.save();
  assert.equal(text, '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[{"name":"Main","cells":{"A1":"=Data!A1*2"},"names":{}},{"name":"Data","cells":{"A1":"5"},"names":{}}]}');
  const loaded = loadWorkbook(text);
  assert.deepEqual(loaded.sheetNames(), ["Main", "Data"]);
  assert.equal(loaded.sheet("Main").get("A1"), 10);
});
