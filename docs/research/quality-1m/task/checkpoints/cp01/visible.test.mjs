// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp01 stores numbers and text", () => {
  const s = createSheet();
  s.set("A1", "42");
  s.set("B2", "hello");
  assert.equal(s.get("A1"), 42);
  assert.equal(s.get("B2"), "hello");
  assert.equal(s.get("C3"), null);
});

test("cp01 empty string clears", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.set("A1", "");
  assert.equal(s.get("A1"), null);
});

test("cp01 invalid address throws #ADDR", () => {
  const s = createSheet();
  assert.throws(() => s.get("A0"), (e) => e.code === "#ADDR" && e.cell === "A0");
});
