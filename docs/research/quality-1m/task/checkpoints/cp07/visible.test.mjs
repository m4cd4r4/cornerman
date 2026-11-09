// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp07 string and boolean literals", () => {
  const s = createSheet();
  s.set("A1", '="a"&"b"');
  s.set("A2", "=TRUE");
  assert.equal(s.get("A1"), "ab");
  assert.equal(s.get("A2"), true);
});

test("cp07 percent", () => {
  const s = createSheet();
  s.set("A1", "=50%");
  assert.equal(s.get("A1"), 0.5);
});
