// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp71 a protected cell refuses set", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.protect("A1");
  assert.equal(s.isProtected("a1"), true);
  assert.throws(() => s.set("A1", "2"), (e) => e.code === "#LOCKED" && e.cell === "A1");
  assert.equal(s.get("A1"), 1);
});

test("cp71 unprotect lifts it", () => {
  const s = createSheet();
  s.protect("A1:B2");
  assert.deepEqual(s.protectedCells(), ["A1", "B1", "A2", "B2"]);
  s.unprotect("B1:B2");
  s.set("B2", "ok");
  assert.deepEqual(s.protectedCells(), ["A1", "A2"]);
  assert.equal(s.getInput("B2"), "ok");
});
