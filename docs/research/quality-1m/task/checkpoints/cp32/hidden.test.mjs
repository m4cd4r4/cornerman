// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkbook } from "../../src/index.mjs";

const err = (v) => (v && typeof v === "object" ? [v.code, v.cell] : v);
function book(...names) {
  const b = createWorkbook();
  return [b, ...names.map((n) => b.addSheet(n))];
}
const evals = (...sheets) => sheets.map((s) => s.stats().evaluations);

test("cp32h a cycle through three sheets", () => {
  const [, a, b, c] = book("Alpha", "Beta", "Gamma");
  a.set("C3", "=Beta!D4+1");
  b.set("D4", "=Gamma!E5*2");
  c.set("E5", "=alpha!C3-1");
  a.set("A1", "=C3");
  c.set("A1", "=Beta!D4");
  assert.deepEqual(err(a.get("C3")), ["#CYCLE!", "C3"]);
  assert.deepEqual(err(b.get("D4")), ["#CYCLE!", "D4"]);
  assert.deepEqual(err(c.get("E5")), ["#CYCLE!", "E5"]);
  assert.deepEqual(err(a.get("A1")), ["#CYCLE!", "C3"]);
  assert.deepEqual(err(c.get("A1")), ["#CYCLE!", "D4"]);
  c.set("E5", "=7");
  assert.equal(a.get("C3"), 15);
  assert.equal(b.get("D4"), 14);
  assert.equal(c.get("A1"), 14);
});

test("cp32h adding a sheet can close a cycle, removing it opens it", () => {
  const [w, a] = book("Alpha");
  a.set("A1", "=Beta!B2+1");
  a.set("A2", "=A1*10");
  a.set("A3", "=Alpha!A1+Beta!B2");
  assert.deepEqual(err(a.get("A1")), ["#REF!", "A1"]);
  assert.deepEqual(err(a.get("A2")), ["#REF!", "A1"]);
  const b = w.addSheet("BETA");
  assert.equal(a.get("A2"), 10);
  b.set("B2", "=Alpha!A2");
  assert.deepEqual(err(a.get("A1")), ["#CYCLE!", "A1"]);
  assert.deepEqual(err(a.get("A2")), ["#CYCLE!", "A2"]);
  assert.deepEqual(err(b.get("B2")), ["#CYCLE!", "B2"]);
  assert.deepEqual(err(a.get("A3")), ["#CYCLE!", "A1"]);
  w.removeSheet("Beta");
  assert.deepEqual(err(a.get("A1")), ["#REF!", "A1"]);
  assert.deepEqual(err(a.get("A2")), ["#REF!", "A1"]);
  assert.deepEqual(err(a.get("A3")), ["#REF!", "A1"]);
  assert.deepEqual(err(b.get("B2")), ["#REF!", "B2"]);
});

test("cp32h precedents and dependents: own sheet first, then sheets in order", () => {
  const [w, zed, ann, mid] = book("Zed", "Ann", "Mid");
  mid.set("A1", "=Ann!B1+Zed!A2+B9+Zed!A1+A3+SUM(Ann!A1:A2)+Mid!C1+Nope!A1");
  assert.deepEqual(mid.precedents("A1"), ["C1", "A3", "B9", "Zed!A1", "Zed!A2", "Ann!A1", "Ann!B1", "Ann!A2"]);
  zed.set("A2", "=Mid!A1");
  zed.set("A1", "1");
  ann.set("Q1", "=Zed!A1");
  assert.deepEqual(zed.dependents("A1"), ["Ann!Q1", "Mid!A1"]);
  assert.deepEqual(zed.precedents("A2"), ["Mid!A1"]);
  w.removeSheet("ann");
  const ann2 = w.addSheet("aNN");
  ann2.set("Z9", "=Zed!A1");
  assert.deepEqual(zed.dependents("A1"), ["Mid!A1", "aNN!Z9"]);
  assert.deepEqual(mid.precedents("A1"), ["C1", "A3", "B9", "Zed!A1", "Zed!A2", "aNN!A1", "aNN!B1", "aNN!A2"]);
  assert.deepEqual(w.sheetNames(), ["Zed", "Mid", "aNN"]);
});

test("cp32h transitive lists through several sheets", () => {
  const [, x, y, z] = book("X", "Y", "Z");
  x.set("A1", "=Y!A1");
  y.set("A1", "=Z!A1+X!B1");
  z.set("A1", "=X!C1");
  x.set("C1", "=1");
  x.set("B1", "=2");
  x.set("D1", "=A1");
  assert.deepEqual(x.precedents("A1", { transitive: true }), ["B1", "C1", "Y!A1", "Z!A1"]);
  assert.deepEqual(x.dependents("C1", { transitive: true }), ["A1", "D1", "Y!A1", "Z!A1"]);
  assert.deepEqual(z.dependents("A1", { transitive: true }), ["X!A1", "X!D1", "Y!A1"]);
  assert.deepEqual(x.precedents("D1"), ["A1"]);
  z.set("A1", "=X!D1");
  assert.deepEqual(z.precedents("A1", { transitive: true }), ["A1", "X!A1", "X!B1", "X!D1", "Y!A1"]);
  assert.deepEqual(y.dependents("A1", { transitive: true }), ["A1", "X!A1", "X!D1", "Z!A1"]);
});

test("cp32h a change re-evaluates only its dependents, counted where they live", () => {
  const [, x, y] = book("X", "Y");
  y.set("A1", "1");
  x.set("A1", "=Y!A1*2");
  x.set("A2", "=A1+1");
  x.set("A3", "5");
  x.set("B1", "=A3");
  y.set("B1", "=X!A2+Y!A1");
  y.set("C1", "=10");
  assert.deepEqual([x.get("A2"), y.get("B1"), x.get("B1"), y.get("C1")], [3, 4, 5, 10]);
  assert.deepEqual(evals(x, y), [3, 2]);
  y.set("A1", "10");
  assert.deepEqual([y.get("B1"), x.get("B1"), y.get("C1")], [31, 5, 10]);
  assert.deepEqual(evals(x, y), [5, 3]);
  assert.equal(x.get("A2"), 21);
  assert.deepEqual(evals(x, y), [5, 3]);
  x.set("A3", "6");
  assert.deepEqual([x.get("B1"), y.get("B1")], [6, 31]);
  assert.deepEqual(evals(x, y), [6, 3]);
  y.set("A1", "10");
  x.undo();
  assert.deepEqual([x.get("B1"), y.get("B1")], [5, 31]);
  assert.deepEqual(evals(x, y), [7, 3]);
});

test("cp32h adding and removing a sheet re-evaluates only formulas that name it", () => {
  const [w, main, other] = book("Main", "Other");
  main.set("A1", "=Gone!A1+1");
  main.set("A2", "=A1*2");
  main.set("A3", "=Other!A1");
  main.set("B1", "=7");
  other.set("A1", "=3");
  other.set("A2", "=Main!A2");
  other.set("B2", "=Main!B1");
  main.recalc();
  other.recalc();
  assert.deepEqual(evals(main, other), [4, 3]);
  const gone = w.addSheet("Gone");
  assert.deepEqual(main.recalc(), ["A1", "A2"]);
  assert.deepEqual(other.recalc(), ["A2"]);
  assert.deepEqual(evals(main, other), [6, 4]);
  gone.set("A1", "4");
  gone.set("A2", "=A1+1");
  assert.deepEqual([other.get("A2"), gone.get("A2")], [10, 5]);
  assert.deepEqual(evals(main, other, gone), [8, 5, 1]);
  w.removeSheet("GONE");
  assert.deepEqual(main.recalc(), ["A1", "A2"]);
  assert.deepEqual(other.recalc(), ["A2"]);
  assert.deepEqual(err(other.get("A2")), ["#REF!", "A1"]);
  assert.deepEqual(evals(main, other), [10, 6]);
  assert.equal(gone.get("A2"), 5);
  assert.deepEqual(evals(gone), [2]);
});

test("cp32h recalc orders through other sheets and returns its own cells", () => {
  const [, main, beta] = book("Main", "Beta");
  main.set("A1", "=Beta!A1");
  beta.set("A1", "=Main!C2");
  main.set("C2", "=3");
  main.set("B1", "=1");
  beta.set("Z9", "=99");
  assert.deepEqual(main.recalc(), ["B1", "C2", "A1"]);
  assert.deepEqual(evals(main, beta), [3, 1]);
  assert.equal(main.get("A1"), 3);
  assert.deepEqual(main.recalc(), []);
  assert.deepEqual(beta.recalc(), ["Z9"]);
  main.set("C2", "=4");
  assert.deepEqual(beta.recalc(), ["A1"]);
  assert.deepEqual(main.recalc(), ["A1"]);
  assert.deepEqual(evals(main, beta), [5, 3]);
});

test("cp32h own cells that depend on each other through other sheets form one group", () => {
  const [, p, q] = book("P", "Q");
  p.set("B1", "=Q!B1");
  q.set("B1", "=P!B2");
  p.set("B2", "=Q!B2");
  q.set("B2", "=P!B1");
  p.set("C1", "=B1");
  p.set("A9", "=1");
  assert.deepEqual(p.recalc(), ["B1", "B2", "C1", "A9"]);
  assert.deepEqual(err(p.get("C1")), ["#CYCLE!", "B1"]);
  assert.deepEqual(evals(q), [0]);
  assert.deepEqual(q.recalc(), ["B1", "B2"]);
});
