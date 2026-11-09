// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkbook } from "../../src/index.mjs";

test("cp32 dependencies cross sheets", () => {
  const book = createWorkbook();
  const alpha = book.addSheet("Alpha");
  const beta = book.addSheet("Beta");
  alpha.set("A1", "=Beta!B2+1");
  beta.set("B2", "=Alpha!A1+1");
  assert.equal(alpha.get("A1").code, "#CYCLE!");
  assert.equal(beta.get("B2").cell, "B2");
  beta.set("B2", "4");
  alpha.set("A2", "=A1*2");
  assert.deepEqual(beta.dependents("B2", { transitive: true }), ["Alpha!A1", "Alpha!A2"]);
  assert.equal(alpha.get("A2"), 10);
});
