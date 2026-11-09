import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp04 errors propagate with their origin cell", () => {
  const s = createSheet();
  s.set("B1", "=1/0");
  s.set("C1", "=B1+1");
  const v = s.get("C1");
  assert.equal(v.code, "#DIV/0!");
  assert.equal(v.cell, "B1");
});
