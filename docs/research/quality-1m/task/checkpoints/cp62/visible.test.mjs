// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

function val(f) {
  const s = createSheet();
  s.set("A1", "4");
  s.set("B1", f);
  return s.get("B1");
}

test("cp62 LET names values inside one formula", () => {
  assert.equal(val("=LET(x, 2, x * 3)"), 6);
  assert.equal(val("=LET(x, A1, y, x + 1, x * y)"), 20);
  assert.equal(val('=LET(greeting, "hi", greeting & "!")'), "hi!");
});

test("cp62 a LET inside another sees the outer names", () => {
  assert.equal(val("=LET(a, 1, LET(b, a + 1, a + b))"), 3);
});
