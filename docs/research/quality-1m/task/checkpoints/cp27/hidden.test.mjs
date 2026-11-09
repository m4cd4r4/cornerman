// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

function sheet(setup = {}) {
  const s = createSheet();
  for (const [k, v] of Object.entries(setup)) s.set(k, v);
  return s;
}
const state = (s) => ({ cells: Object.fromEntries(s.cells().map((k) => [k, s.getInput(k)])), names: s.names() });

test("cp27h nothing to undo or redo", () => {
  const s = createSheet();
  assert.equal(s.undo(), false);
  assert.equal(s.redo(), false);
  s.set("A1", "1");
  assert.equal(s.redo(), false);
  assert.equal(s.getInput("A1"), "1");
});

test("cp27h set, clear and redo in order", () => {
  const s = sheet({ A1: "1", B1: "=A1*2" });
  s.set("A1", "5");
  s.set("B1", "");
  assert.equal(s.getInput("B1"), null);
  assert.equal(s.undo(), true);
  assert.equal(s.get("B1"), 10);
  assert.equal(s.undo(), true);
  assert.equal(s.get("B1"), 2);
  assert.equal(s.redo(), true);
  assert.equal(s.get("B1"), 10);
  assert.equal(s.redo(), true);
  assert.equal(s.getInput("B1"), null);
  assert.equal(s.redo(), false);
});

test("cp27h no-ops and throws are not recorded", () => {
  const s = sheet({ A1: "1" });
  s.set("A1", "1");
  s.set("C3", "");
  assert.throws(() => s.set("A0", "1"));
  assert.throws(() => s.insertRows(0));
  assert.throws(() => s.copy("A1", "ZZ0"));
  s.copy("A1", "A1");
  s.insertRows(5);
  s.deleteCols("D");
  assert.equal(s.removeName("NOPE"), false);
  s.defineName("R", "B1");
  s.defineName("r", "b1");
  assert.equal(s.undo(), true);
  assert.deepEqual(s.names(), {});
  assert.equal(s.undo(), true);
  assert.equal(s.getInput("A1"), null);
  assert.equal(s.undo(), false);
});

test("cp27h a new action empties the redo list, a no-op does not", () => {
  const s = sheet({ A1: "1", A2: "2" });
  s.undo();
  s.set("A1", "1");
  s.insertRows(9);
  assert.equal(s.redo(), true);
  assert.equal(s.getInput("A2"), "2");
  s.undo();
  s.set("B1", "x");
  assert.equal(s.redo(), false);
  assert.deepEqual(s.cells(), ["A1", "B1"]);
});

test("cp27h a copy is one step", () => {
  const s = sheet({ A1: "1", A2: "=A1+1", C2: "old", C3: "keep" });
  const before = state(s);
  s.copy("A1:A3", "C1");
  assert.deepEqual([s.getInput("C1"), s.getInput("C2"), s.getInput("C3")], ["1", "=C1+1", null]);
  const after = state(s);
  assert.equal(s.undo(), true);
  assert.deepEqual(state(s), before);
  assert.equal(s.redo(), true);
  assert.deepEqual(state(s), after);
  assert.equal(s.get("C2"), 2);
});

test("cp27h names are put back", () => {
  const s = sheet({ A1: "2", B1: "3", Z1: "=R*10" });
  s.defineName("R", "A1");
  s.defineName("R", "B1");
  assert.equal(s.get("Z1"), 30);
  s.removeName("r");
  assert.equal(s.get("Z1").code, "#NAME?");
  s.undo();
  assert.equal(s.get("Z1"), 30);
  s.undo();
  assert.deepEqual(s.names(), { R: "A1" });
  assert.equal(s.get("Z1"), 20);
  s.undo();
  assert.deepEqual(s.names(), {});
  s.redo();
  s.redo();
  s.redo();
  assert.deepEqual(s.names(), {});
  assert.equal(s.redo(), false);
});

test("cp27h row and column operations are put back exactly", () => {
  const s = sheet({ a1: "1", A3: "=sum(a1:a2)", B2: "=$A$1", C9: "=A3" });
  s.defineName("TOP", "A1:B2");
  const s0 = state(s);
  s.insertRows(2, 3);
  const s1 = state(s);
  s.deleteCols("A");
  const s2 = state(s);
  assert.deepEqual(s2.names, { TOP: "A1:A5" });
  assert.deepEqual(s2.cells, { A5: "=#REF!", B12: "=#REF!" });
  s.undo();
  assert.deepEqual(state(s), s1);
  s.undo();
  assert.deepEqual(state(s), s0);
  assert.equal(s.getInput("A3"), "=sum(a1:a2)");
  assert.equal(s.get("C9"), 1);
  s.redo();
  s.redo();
  assert.deepEqual(state(s), s2);
  assert.deepEqual(s.dependents("A1"), []);
});

test("cp27h at most 100 steps", () => {
  const s = createSheet();
  for (let i = 1; i <= 105; i++) s.set("A" + i, String(i));
  let n = 0;
  while (s.undo()) n++;
  assert.equal(n, 100);
  assert.deepEqual(s.cells(), ["A1", "A2", "A3", "A4", "A5"]);
  let m = 0;
  while (s.redo()) m++;
  assert.equal(m, 100);
  assert.equal(s.cells().length, 105);
});

test("cp27h undo re-evaluates only what changed", () => {
  const s = sheet({ A1: "1", B1: "=A1*2", C1: "=B1+1", D1: "=5", E1: "=D1" });
  for (const k of ["C1", "E1"]) s.get(k);
  s.set("A1", "3");
  assert.equal(s.get("C1"), 7);
  const before = s.stats().evaluations;
  s.undo();
  assert.deepEqual(s.recalc(), ["B1", "C1"]);
  assert.equal(s.get("C1"), 3);
  assert.equal(s.get("E1"), 5);
  assert.equal(s.stats().evaluations - before, 2);
  s.insertCols("A");
  assert.equal(s.getInput("C1"), "=B1*2");
  s.undo();
  assert.equal(s.getInput("B1"), "=A1*2");
  const mid = s.stats().evaluations;
  assert.deepEqual(s.recalc(), ["B1", "C1", "D1", "E1"]);
  assert.equal(s.stats().evaluations - mid, 4);
});
