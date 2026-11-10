// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp67 a formula of 1,000 characters is accepted, 1,001 refused", () => {
  const s = createSheet();
  const f = "=1" + "+1".repeat(499);
  assert.equal(f.length, 1000);
  s.set("A1", f);
  assert.equal(s.get("A1"), 500);
  assert.throws(() => s.set("A2", f + " "), (e) => e.code === "#LIMIT" && e.cell === "A2");
  assert.equal(s.getInput("A2"), null);
});

test("cp67 at most 16 parentheses may be open at once", () => {
  const s = createSheet();
  s.set("A1", "=" + "(".repeat(16) + "7" + ")".repeat(16));
  assert.equal(s.get("A1"), 7);
  assert.throws(() => s.set("A2", "=" + "(".repeat(17) + "7" + ")".repeat(17)), (e) => e.code === "#LIMIT" && e.cell === "A2");
});
