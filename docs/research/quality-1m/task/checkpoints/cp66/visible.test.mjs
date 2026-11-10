// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkbook } from "../../src/index.mjs";

test("cp66 a batch that returns keeps its changes and gives fn's result", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const r = b.batch((book) => {
    book.sheet("Main").set("A1", "2");
    m.set("A2", "=A1*3");
    return m.get("A2");
  });
  assert.equal(r, 6);
  assert.equal(m.get("A2"), 6);
});

test("cp66 a batch that throws is rolled back and the error thrown again", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  m.set("A1", "1");
  const boom = new Error("boom");
  assert.throws(() => b.batch(() => { m.set("A1", "5"); m.set("B1", "x"); throw boom; }), (e) => e === boom);
  assert.equal(m.get("A1"), 1);
  assert.equal(m.getInput("B1"), null);
});
