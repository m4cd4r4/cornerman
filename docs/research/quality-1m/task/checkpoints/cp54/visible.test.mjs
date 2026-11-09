// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkbook } from "../../src/index.mjs";

test("cp54 deleting a sheet rewrites references to it as #REF!", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.set("A1", "5");
  m.set("A1", "=Data!A1*2");
  m.set("A2", "=1+1");
  assert.equal(b.deleteSheet("data"), 1);
  assert.deepEqual(b.sheetNames(), ["Main"]);
  assert.equal(m.getInput("A1"), "=#REF!*2");
  assert.equal(m.get("A1").code, "#REF!");
  assert.equal(m.get("A2"), 2);
});

test("cp54 a sheet added later with that name is not read", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  b.addSheet("Data");
  m.set("A1", "=Data!A1");
  b.deleteSheet("Data");
  b.addSheet("Data").set("A1", "9");
  assert.equal(m.get("A1").code, "#REF!");
});
