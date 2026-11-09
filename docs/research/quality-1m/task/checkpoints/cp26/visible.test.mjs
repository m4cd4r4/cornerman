// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp26 absolute references and copy", () => {
  const s = createSheet();
  s.set("B1", "10");
  s.set("A2", "1");
  s.set("B2", "=A2*$B$1");
  assert.equal(s.get("B2"), 10);
  s.set("A3", "2");
  s.copy("B2", "B3");
  assert.equal(s.getInput("B3"), "=A3*$B$1");
  assert.equal(s.get("B3"), 20);
});
