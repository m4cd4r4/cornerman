// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

function val(f) {
  const s = createSheet();
  s.set("A1", f);
  return s.get("A1");
}

test("cp17 IF picks a branch", () => {
  assert.equal(val('=IF(2>1, "yes", "no")'), "yes");
  assert.equal(val('=IF(0, "yes", "no")'), "no");
  assert.equal(val("=IF(1=2, 5)"), false);
});

test("cp17 AND, OR, NOT", () => {
  assert.equal(val("=AND(TRUE, 1, 2>1)"), true);
  assert.equal(val("=OR(FALSE, 0)"), false);
  assert.equal(val("=NOT(0)"), true);
});
