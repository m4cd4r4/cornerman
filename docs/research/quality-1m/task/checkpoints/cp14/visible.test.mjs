// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp14 a cell name and a range name", () => {
  const s = createSheet();
  s.set("A1", "2");
  s.set("A2", "3");
  s.defineName("rate", "A1");
  s.defineName("vals", "A1:A2");
  s.set("B1", "=rate*10+SUM(vals)");
  assert.equal(s.get("B1"), 25);
  assert.deepEqual(s.names(), { RATE: "A1", VALS: "A1:A2" });
});

test("cp14 an invalid name throws #BADNAME", () => {
  const s = createSheet();
  assert.throws(() => s.defineName("A1", "B2"), (e) => e.code === "#BADNAME" && e.cell === "A1");
});
