// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

function val(f) {
  const s = createSheet();
  s.set("A1", "10");
  s.set("B1", f);
  return s.get("B1");
}

test("cp60 CHOOSE picks by position", () => {
  assert.equal(val('=CHOOSE(2, "a", "b", "c")'), "b");
  assert.equal(val("=CHOOSE(1, A1 * 2, 5)"), 20);
  assert.equal(val('=CHOOSE(3, 1, 2, "x")'), "x");
});

test("cp60 SWITCH picks the result of the matching case", () => {
  assert.equal(val('=SWITCH(A1, 5, "five", 10, "ten")'), "ten");
  assert.equal(val('=SWITCH(A1, 5, "five", "other")'), "other");
  assert.equal(val('=SWITCH("b", "a", 1, "b", 2)'), 2);
});
