// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

function val(f) {
  const s = createSheet();
  s.set("A1", f);
  return s.get("A1");
}

test("cp16 ROUND, ROUNDUP, ROUNDDOWN basics", () => {
  assert.equal(val("=ROUND(1.26, 1)"), 1.3);
  assert.equal(val("=ROUNDUP(1.21, 1)"), 1.3);
  assert.equal(val("=ROUNDDOWN(1.29, 1)"), 1.2);
  assert.equal(val("=ROUND(1234.5678, -2)"), 1200);
});
