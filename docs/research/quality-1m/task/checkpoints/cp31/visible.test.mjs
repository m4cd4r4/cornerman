// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkbook } from "../../src/index.mjs";

test("cp31 a formula reads another sheet", () => {
  const book = createWorkbook();
  assert.deepEqual(book.sheetNames(), []);
  const main = book.addSheet("Main");
  main.set("A1", "=Data!B2*2");
  assert.equal(main.get("A1").code, "#REF!");
  const data = book.addSheet("Data");
  data.set("B2", "5");
  assert.equal(main.get("A1"), 10);
  assert.deepEqual(book.sheetNames(), ["Main", "Data"]);
  assert.equal(book.sheet("data"), data);
});
