// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp52 a constant name gives its value in a formula", () => {
  const s = createSheet();
  assert.equal(s.defineConstant("rate", 0.25), undefined);
  s.set("A1", "200");
  s.set("A2", "=A1*RATE");
  assert.equal(s.get("A2"), 50);
  s.defineConstant("RATE", 0.5);
  assert.equal(s.get("A2"), 100);
});

test("cp52 names() lists constants beside cell names", () => {
  const s = createSheet();
  s.defineConstant("RATE", 0.25);
  s.defineName("TOTAL", "B2");
  assert.deepEqual(s.names(), { RATE: "=0.25", TOTAL: "B2" });
});
