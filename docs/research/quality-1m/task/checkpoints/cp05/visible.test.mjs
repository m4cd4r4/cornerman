import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp05 display basics", () => {
  const s = createSheet();
  s.set("A1", "=1/4");
  s.set("A2", "text");
  s.set("A3", "=1/0");
  assert.equal(s.display("A1"), "0.25");
  assert.equal(s.display("A2"), "text");
  assert.equal(s.display("A3"), "#DIV/0!");
  assert.equal(s.display("A4"), "");
});
