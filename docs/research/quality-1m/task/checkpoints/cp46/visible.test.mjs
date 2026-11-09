// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp46 a whole-number rule refuses other inputs", () => {
  const s = createSheet();
  s.setValidation("A1:A5", { type: "whole", min: 1, max: 10 });
  assert.deepEqual(s.getValidation("A3"), { type: "whole", min: 1, max: 10 });
  s.set("A1", "7");
  assert.equal(s.get("A1"), 7);
  assert.throws(() => s.set("A2", "42"), (e) => e.code === "#INVALID" && e.cell === "A2");
  assert.equal(s.getInput("A2"), null);
});

test("cp46 a list rule accepts only its items", () => {
  const s = createSheet();
  s.setValidation("B1", { type: "list", items: ["Yes", "No"] });
  s.set("B1", "No");
  assert.equal(s.get("B1"), "No");
  assert.throws(() => s.set("B1", "Maybe"), (e) => e.code === "#INVALID" && e.cell === "B1");
  assert.equal(s.get("B1"), "No");
  s.setValidation("B1", null);
  assert.equal(s.getValidation("B1"), null);
  s.set("B1", "Maybe");
  assert.equal(s.get("B1"), "Maybe");
});
