// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

function val(f) {
  const s = createSheet();
  s.set("A1", f);
  return s.get("A1");
}

test("cp18 text functions", () => {
  assert.equal(val('=LEN("hello")'), 5);
  assert.equal(val('=UPPER("abc")'), "ABC");
  assert.equal(val('=LOWER("AbC")'), "abc");
  assert.equal(val('=LEFT("hello", 2)'), "he");
  assert.equal(val('=RIGHT("hello", 3)'), "llo");
  assert.equal(val('=MID("hello", 2, 3)'), "ell");
  assert.equal(val('=TRIM("  hi ")'), "hi");
});
