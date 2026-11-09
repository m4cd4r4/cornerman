// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

function val(f) {
  const s = createSheet();
  s.set("A1", f);
  return s.get("A1");
}

test("cp20 ISERROR and IFERROR", () => {
  assert.equal(val("=ISERROR(1/0)"), true);
  assert.equal(val("=ISERROR(5)"), false);
  assert.equal(val("=IFERROR(1/0, 7)"), 7);
  assert.equal(val("=IFERROR(3, 7)"), 3);
});
