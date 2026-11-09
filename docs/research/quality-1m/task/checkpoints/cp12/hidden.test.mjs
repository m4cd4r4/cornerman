// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp12h free cells go in row-major order, chosen again after each", () => {
  const s = createSheet();
  s.set("A1", "=B2");
  s.set("B1", "=1");
  s.set("B2", "=B1");
  s.set("C2", "=5");
  assert.deepEqual(s.recalc(), ["B1", "B2", "A1", "C2"]);
});

test("cp12h order is not a depth-first walk", () => {
  const s = createSheet();
  s.set("A1", "=D1+C1");
  s.set("B1", "=2");
  s.set("C1", "=3");
  s.set("D1", "=C1");
  assert.deepEqual(s.recalc(), ["B1", "C1", "D1", "A1"]);
});

test("cp12h only cells needing evaluation are returned", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.set("B1", "=A1");
  s.set("C1", "=9");
  s.set("A2", "=B1+C1");
  s.recalc();
  s.set("A1", "2");
  assert.deepEqual(s.recalc(), ["B1", "A2"]);
  s.get("C1");
  s.set("C1", "=10");
  assert.equal(s.get("C1"), 10);
  assert.deepEqual(s.recalc(), ["A2"]);
});

test("cp12h each returned cell is evaluated once and reads afterwards are free", () => {
  const s = createSheet();
  s.set("A1", "=B1+B1");
  s.set("B1", "=C1*2");
  s.set("C1", "=1");
  const n = s.stats().evaluations;
  const order = s.recalc();
  assert.equal(s.stats().evaluations - n, order.length);
  s.get("A1");
  s.display("B1");
  assert.equal(s.stats().evaluations - n, 3);
  assert.equal(s.get("A1"), 4);
});

test("cp12h a cycle moves as one group placed by its first member", () => {
  const s = createSheet();
  s.set("A2", "=B1");
  s.set("B1", "=A2+C9");
  s.set("A1", "=B1+1");
  s.set("C3", "=1");
  s.set("C9", "=2");
  assert.deepEqual(s.recalc(), ["C3", "C9", "B1", "A2", "A1"]);
  assert.equal(s.get("A1").code, "#CYCLE!");
});

test("cp12h unparsable formulas are free at once", () => {
  const s = createSheet();
  s.set("B1", "=1+");
  s.set("A1", "=B1");
  s.set("C1", "=2");
  assert.deepEqual(s.recalc(), ["B1", "A1", "C1"]);
  assert.equal(s.get("A1").code, "#PARSE!");
});
