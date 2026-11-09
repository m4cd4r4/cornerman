// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

const isErr = (v, code, cell) => v && typeof v === "object" && v.code === code && v.cell === cell && typeof v.message === "string" && v.message.length > 0;
function sheet(setup = {}) {
  const s = createSheet();
  for (const [k, v] of Object.entries(setup)) s.set(k, v);
  return s;
}
// The formula sits in Z1, which never moves when at >= 2.
function after(formula, at, count) {
  const s = sheet({ Z1: formula });
  s.insertRows(at, count);
  return s.getInput("Z1");
}
const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;

test("cp23h cells at or below the insert point move down", () => {
  const s = sheet({ A1: "1", A3: "3", B5: "x", C2: "=1+1" });
  s.insertRows(3, 2);
  assert.deepEqual(s.cells(), ["A1", "C2", "A5", "B7"]);
  assert.equal(s.get("A5"), 3);
  assert.equal(s.get("A3"), null);
  assert.equal(s.getInput("B7"), "x");
  assert.equal(s.get("C2"), 2);
});

test("cp23h single references", () => {
  assert.equal(after("=A2+A3", 3), "=A2+A4");
  assert.equal(after("=A3", 3, 5), "=A8");
  assert.equal(after("=B2*C9", 2), "=B3*C10");
  assert.equal(after("=A2", 3), "=A2");
});

test("cp23h range corners move one at a time", () => {
  assert.equal(after("=SUM(A2:A5)", 3), "=SUM(A2:A6)");
  assert.equal(after("=SUM(A2:A5)", 2), "=SUM(A3:A6)");
  assert.equal(after("=SUM(A2:A5)", 5), "=SUM(A2:A6)");
  assert.equal(after("=SUM(A2:A5)", 6), "=SUM(A2:A5)");
  assert.equal(after("=SUM(A5:A2)", 3), "=SUM(A6:A2)");
  assert.equal(after("=SUM(B2:C5)", 4, 3), "=SUM(B2:C8)");
});

test("cp23h only moved references change, and they are upper-cased", () => {
  assert.equal(after('=sum(a5:a2) + a1 & "A5" & rate & LOG10(1)', 3, 2), '=sum(A7:a2) + a1 & "A5" & rate & LOG10(1)');
  assert.equal(after("=  b4 +b1", 2), "=  B5 +b1");
  assert.equal(after("=A5+", 2), "=A5+");
});

test("cp23h references pushed past row 9999 become #REF!", () => {
  const s = sheet({ Z1: "=A9999+1", Z2: "=SUM(A2:A9999)", Z3: "=SUM(A9998:A9999)", Z4: "=1+#REF!" });
  s.insertRows(9999);
  assert.equal(s.getInput("Z1"), "=#REF!+1");
  assert.equal(s.getInput("Z2"), "=SUM(#REF!)");
  assert.equal(s.getInput("Z3"), "=SUM(#REF!)");
  assert.equal(s.getInput("Z4"), "=1+#REF!");
  for (const k of ["Z1", "Z2", "Z3", "Z4"]) assert.ok(isErr(s.get(k), "#REF!", k), k);
});

test("cp23h bad arguments and a full sheet throw and change nothing", () => {
  const s = sheet({ A9999: "x", A2: "=A9999" });
  assert.throws(() => s.insertRows(1), thrown("#FULL", "1"));
  assert.throws(() => s.insertRows(9999), thrown("#FULL", "9999"));
  for (const [at, count] of [[0, 1], [10000, 1], [1.5, 1], [2, 0], [9999, 2], ["3", 1], [2, -1]]) {
    assert.throws(() => s.insertRows(at, count), thrown("#ARG", String(at)), `${at} ${count}`);
  }
  assert.deepEqual(s.cells(), ["A2", "A9999"]);
  assert.equal(s.getInput("A2"), "=A9999");
  const t = sheet({ A9998: "x" });
  t.insertRows(9999);
  assert.deepEqual(t.cells(), ["A9998"]);
});

test("cp23h moved formulas are rewritten and recalculated", () => {
  const s = sheet({ A3: "5", A4: "=A3+1", B1: "=A3*2" });
  assert.equal(s.get("A4"), 6);
  assert.equal(s.get("B1"), 10);
  const before = s.stats().evaluations;
  s.insertRows(2);
  assert.equal(s.getInput("A5"), "=A4+1");
  assert.equal(s.getInput("B1"), "=A4*2");
  assert.equal(s.get("A5"), 6);
  assert.equal(s.get("B1"), 10);
  assert.equal(s.stats().evaluations - before, 2);
  assert.deepEqual(s.precedents("B1"), ["A4"]);
  assert.deepEqual(s.dependents("A4"), ["B1", "A5"]);
});

test("cp23h names move, and a name pushed off the sheet is removed", () => {
  const s = sheet({ A2: "1", A3: "2", A5: "4", Z1: "=SUM(R)" });
  s.defineName("R", "A2:A5");
  s.defineName("TOP", "A1");
  s.defineName("EDGE", "B9999");
  s.insertRows(3);
  assert.deepEqual(s.names(), { R: "A2:A6", TOP: "A1" });
  assert.equal(s.get("Z1"), 7);
  s.set("A3", "10");
  assert.equal(s.get("Z1"), 17);
});

test("cp23h cycles follow the new text", () => {
  const s = sheet({ A1: "=A3", A3: "=A1" });
  s.insertRows(2);
  assert.equal(s.getInput("A1"), "=A4");
  assert.equal(s.getInput("A4"), "=A1");
  assert.ok(isErr(s.get("A1"), "#CYCLE!", "A1"));
  assert.ok(isErr(s.get("A4"), "#CYCLE!", "A4"));
});
