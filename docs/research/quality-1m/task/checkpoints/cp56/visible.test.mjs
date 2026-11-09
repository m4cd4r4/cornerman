// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkbook, loadWorkbook } from "../../src/index.mjs";

test("cp56 a workbook with a format saves as version 3 and loads it back", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  m.set("A1", "0.5");
  m.setFormat("A1", "0%");
  const text = b.save();
  assert.equal(JSON.parse(text).version, 3);
  const c = loadWorkbook(text);
  assert.equal(c.sheet("Main").display("A1"), "50%");
  assert.equal(c.save(), text);
});

test("cp56 a workbook without those layers still saves as version 2", () => {
  const b = createWorkbook();
  b.addSheet("Main").set("A1", "1");
  assert.equal(b.save(), '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[{"name":"Main","cells":{"A1":"1"},"names":{}}]}');
});
