// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp10h precedents are unique, upper case, row-major, and include empty cells", () => {
  const s = createSheet();
  s.set("D4", "=b2+a2+B2*AA1+c1");
  assert.deepEqual(s.precedents("d4"), ["C1", "AA1", "A2", "B2"]);
});

test("cp10h invalid references are not precedents", () => {
  const s = createSheet();
  s.set("A1", "=A0+B1+C10000");
  assert.deepEqual(s.precedents("A1"), ["B1"]);
});

test("cp10h non-formulas, empty cells and parse failures have no precedents", () => {
  const s = createSheet();
  s.set("A1", "5");
  s.set("A2", "=B1+");
  assert.deepEqual(s.precedents("A1"), []);
  assert.deepEqual(s.precedents("Z9"), []);
  assert.deepEqual(s.precedents("A2"), []);
});

test("cp10h references count even when evaluation never reads them", () => {
  const s = createSheet();
  s.set("A1", "=A0+B1");
  assert.deepEqual(s.precedents("A1"), ["B1"]);
  assert.deepEqual(s.dependents("B1"), ["A1"]);
});

test("cp10h dependents of an empty cell, direct and transitive", () => {
  const s = createSheet();
  s.set("B1", "=Q9*2");
  s.set("A2", "=B1");
  s.set("A1", "=A2+B1");
  assert.deepEqual(s.dependents("Q9"), ["B1"]);
  assert.deepEqual(s.dependents("Q9", { transitive: true }), ["A1", "B1", "A2"]);
  assert.deepEqual(s.dependents("A1"), []);
});

test("cp10h transitive results contain the cell itself only on a cycle", () => {
  const s = createSheet();
  s.set("A1", "=B1");
  s.set("B1", "=C1+A1");
  s.set("D1", "=A1");
  assert.deepEqual(s.precedents("A1", { transitive: true }), ["A1", "B1", "C1"]);
  assert.deepEqual(s.dependents("A1", { transitive: true }), ["A1", "B1", "D1"]);
  assert.deepEqual(s.precedents("D1", { transitive: true }), ["A1", "B1", "C1"]);
});

test("cp10h relations follow edits", () => {
  const s = createSheet();
  s.set("C3", "=A1");
  s.set("C3", "=B2");
  assert.deepEqual(s.dependents("A1"), []);
  assert.deepEqual(s.dependents("B2"), ["C3"]);
  s.set("C3", "7");
  assert.deepEqual(s.dependents("B2"), []);
});

test("cp10h invalid addresses throw #ADDR", () => {
  const s = createSheet();
  for (const fn of ["precedents", "dependents"]) {
    assert.throws(() => s[fn]("A0"), (e) => e.code === "#ADDR" && e.cell === "A0");
  }
});
