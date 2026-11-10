// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

function val(f) {
  const s = createSheet();
  s.set("A1", "Hello World");
  s.set("B1", f);
  return s.get("B1");
}

test("cp61 SUBSTITUTE replaces text", () => {
  assert.equal(val('=SUBSTITUTE(A1, "o", "0")'), "Hell0 W0rld");
  assert.equal(val('=SUBSTITUTE(A1, "o", "0", 2)'), "Hello W0rld");
});

test("cp61 FIND and SEARCH give a position", () => {
  assert.equal(val('=FIND("World", A1)'), 7);
  assert.equal(val('=FIND("o", A1, 6)'), 8);
  assert.equal(val('=SEARCH("world", A1)'), 7);
  assert.equal(val('=SEARCH("w?r", A1)'), 7);
});
