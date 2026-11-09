// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp34 reading-order errors are opt-in", () => {
  const fill = (s) => { s.set("A1", "=1/0"); s.set("B1", "=nope"); s.set("C1", "=A1+B1"); return s; };
  assert.equal(fill(createSheet()).get("C1").code, "#NAME?");
  assert.equal(fill(createSheet({ errorOrder: "priority" })).get("C1").code, "#NAME?");
  assert.equal(fill(createSheet({ errorOrder: "first" })).get("C1").code, "#DIV/0!");
});
