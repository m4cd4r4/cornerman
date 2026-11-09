// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp08 tolerance in equality", () => {
  const s = createSheet();
  s.set("A1", "=0.1+0.2=0.3");
  assert.equal(s.get("A1"), true);
});

test("cp08 evaluation counter caches", () => {
  const s = createSheet();
  s.set("A1", "=1+1");
  s.get("A1");
  const n = s.stats().evaluations;
  s.get("A1");
  s.display("A1");
  assert.equal(s.stats().evaluations, n);
});
