// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet, loadSheet } from "../../src/index.mjs";

test("cp30 save and load", () => {
  const s = createSheet();
  s.set("A1", "3");
  s.set("B1", "=A1*2");
  s.defineName("rate", "a1");
  const text = s.save();
  assert.equal(text, '{"format":"sheet","version":1,"cells":{"A1":"3","B1":"=A1*2"},"names":{"RATE":"A1"}}');
  const t = loadSheet(text);
  assert.equal(t.get("B1"), 6);
  assert.deepEqual(t.names(), { RATE: "A1" });
});
