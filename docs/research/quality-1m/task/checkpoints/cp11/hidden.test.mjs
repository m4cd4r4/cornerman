// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

function grid() {
  const s = createSheet();
  s.set("A1", "1");
  s.set("B1", "=A1+1");
  s.set("C1", "=B1*2");
  s.set("D1", "=7");
  s.set("E1", "=D1+C1");
  s.set("F1", "=D1");
  for (const c of ["B1", "C1", "D1", "E1", "F1"]) s.get(c);
  return s;
}
const evals = (s) => s.stats().evaluations;

test("cp11h only transitive dependents are evaluated again", () => {
  const s = grid();
  const n = evals(s);
  s.set("A1", "5");
  for (const c of ["B1", "C1", "D1", "E1", "F1"]) s.get(c);
  assert.equal(evals(s) - n, 3); // B1, C1, E1
  assert.equal(s.get("E1"), 19);
});

test("cp11h set evaluates nothing", () => {
  const s = grid();
  const n = evals(s);
  s.set("A1", "9");
  s.set("D1", "=8");
  assert.equal(evals(s), n);
});

test("cp11h the changed formula itself is evaluated, its precedents are not", () => {
  const s = grid();
  const n = evals(s);
  s.set("C1", "=B1*3");
  assert.equal(s.get("E1"), 13);
  assert.equal(s.get("B1"), 2);
  assert.equal(evals(s) - n, 2); // C1, E1
});

test("cp11h setting the same input changes nothing", () => {
  const s = grid();
  const n = evals(s);
  s.set("A1", "1");
  s.set("D1", "=7");
  s.set("Z9", "");
  for (const c of ["B1", "C1", "D1", "E1", "F1"]) s.get(c);
  assert.equal(evals(s), n);
});

test("cp11h a cell read many times is evaluated once per change", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.set("B1", "=A1*10");
  s.set("C1", "=B1+B1+B1");
  s.set("D1", "=B1+C1");
  s.get("D1");
  const n = evals(s);
  s.set("A1", "2");
  assert.equal(s.get("D1"), 80);
  assert.equal(evals(s) - n, 3);
});

test("cp11h clearing a cell marks its dependents", () => {
  const s = grid();
  const n = evals(s);
  s.set("A1", "");
  assert.equal(s.get("E1"), 9);
  assert.equal(s.get("F1"), 7);
  assert.equal(evals(s) - n, 3);
});

test("cp11h cycles made and broken stay correct under incremental marking", () => {
  const s = createSheet();
  s.set("A1", "=B1");
  s.set("B1", "1");
  s.set("C1", "=A1+1");
  assert.equal(s.get("C1"), 2);
  s.set("B1", "=C1");
  assert.equal(s.get("A1").code, "#CYCLE!");
  assert.equal(s.get("C1").code, "#CYCLE!");
  s.set("B1", "3");
  assert.equal(s.get("C1"), 4);
});
