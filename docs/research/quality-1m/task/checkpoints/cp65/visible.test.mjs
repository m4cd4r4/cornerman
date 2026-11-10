// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp65 set fires an event listing the cell", () => {
  const s = createSheet();
  const seen = [];
  s.onChange((e) => seen.push(e.cells));
  s.set("a1", "5");
  s.set("B2", "=A1*2");
  assert.deepEqual(seen, [["A1"], ["B2"]]);
});

test("cp65 setMany fires one event and off stops the listener", () => {
  const s = createSheet();
  const seen = [];
  const off = s.onChange((e) => seen.push(e.cells));
  s.setMany({ B1: "x", A2: "=B1" });
  assert.deepEqual(seen, [["B1", "A2"]]);
  assert.equal(off(), true);
  s.set("C1", "1");
  assert.equal(seen.length, 1);
});
