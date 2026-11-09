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
// The formula sits in A99, which never moves when at is B or later.
function ins(formula, at, count) {
  const s = sheet({ A99: formula });
  s.insertCols(at, count);
  return s.getInput("A99");
}
function del(formula, at, count) {
  const s = sheet({ A99: formula });
  s.deleteCols(at, count);
  return s.getInput("A99");
}
const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;

test("cp25h cells move right and left", () => {
  const s = sheet({ A1: "1", C1: "3", E7: "x", Z2: "z" });
  s.insertCols("c", 2);
  assert.deepEqual(s.cells(), ["A1", "E1", "AB2", "G7"]);
  s.deleteCols("B", 4);
  assert.deepEqual(s.cells(), ["A1", "X2", "C7"]);
  assert.equal(s.get("A1"), 1);
  assert.equal(s.getInput("C7"), "x");
});

test("cp25h references and ranges on insert", () => {
  assert.equal(ins("=B1+C1", "C"), "=B1+D1");
  assert.equal(ins("=Z5", "B", 3), "=AC5");
  assert.equal(ins("=SUM(B1:E1)", "C"), "=SUM(B1:F1)");
  assert.equal(ins("=SUM(B1:E1)", "B"), "=SUM(C1:F1)");
  assert.equal(ins("=SUM(B1:E1)", "E"), "=SUM(B1:F1)");
  assert.equal(ins("=SUM(B1:E1)", "F"), "=SUM(B1:E1)");
  assert.equal(ins("=SUM(E3:B1)", "C"), "=SUM(F3:B1)");
  assert.equal(ins("=SUM(b2:d9) & \"D9\" & d9", "c"), "=SUM(b2:E9) & \"D9\" & E9");
});

test("cp25h references pushed past ZZ become #REF!", () => {
  assert.equal(ins("=ZZ1+1", "B"), "=#REF!+1");
  assert.equal(ins("=SUM(B1:ZY1)", "C", 2), "=SUM(#REF!)");
  assert.equal(ins("=SUM(B1:ZY1)", "C"), "=SUM(B1:ZZ1)");
  const s = sheet({ A99: "=ZZ1" });
  s.insertCols("ZZ");
  assert.ok(isErr(s.get("A99"), "#REF!", "A99"));
});

test("cp25h references and ranges on delete", () => {
  assert.equal(del("=C1*2", "C"), "=#REF!*2");
  assert.equal(del("=E1", "C"), "=D1");
  assert.equal(del("=B1", "C"), "=B1");
  assert.equal(del("=SUM(B1:E1)", "C"), "=SUM(B1:D1)");
  assert.equal(del("=SUM(C1:E1)", "B", 2), "=SUM(B1:C1)");
  assert.equal(del("=SUM(B1:E1)", "D", 3), "=SUM(B1:C1)");
  assert.equal(del("=SUM(B1:E1)", "B", 4), "=SUM(#REF!)");
  assert.equal(del("=SUM(E2:B1)", "E"), "=SUM(D2:B1)");
  assert.equal(del("=SUM(B2:E5)", "C", 2), "=SUM(B2:C5)");
});

test("cp25h bad arguments and a full row throw and change nothing", () => {
  const s = sheet({ ZZ3: "x", B1: "=ZZ3" });
  assert.throws(() => s.insertCols("A"), thrown("#FULL", "A"));
  assert.throws(() => s.insertCols("zz"), thrown("#FULL", "zz"));
  for (const [at, count] of [[2, 1], ["", 1], ["AAA", 1], ["A1", 1], ["B", 0], ["ZZ", 2], ["B", 1.5], [null, 1]]) {
    assert.throws(() => s.insertCols(at, count), thrown("#ARG", String(at)), `${at} ${count}`);
    assert.throws(() => s.deleteCols(at, count), thrown("#ARG", String(at)), `${at} ${count}`);
  }
  assert.deepEqual(s.cells(), ["B1", "ZZ3"]);
  assert.equal(s.getInput("B1"), "=ZZ3");
});

test("cp25h names move, shrink, or are removed", () => {
  const s = sheet({ B1: "5", D1: "7", A9: "=SUM(R)" });
  s.defineName("R", "B1:D1");
  s.defineName("GONE", "C1:C4");
  s.defineName("EDGE", "ZZ1");
  s.defineName("LEFT", "A1");
  s.insertCols("C");
  assert.deepEqual(s.names(), { GONE: "D1:D4", LEFT: "A1", R: "B1:E1" });
  assert.equal(s.get("A9"), 12);
  s.deleteCols("D");
  assert.deepEqual(s.names(), { LEFT: "A1", R: "B1:D1" });
  assert.equal(s.get("A9"), 12);
});

test("cp25h row and column operations stay on their own axis", () => {
  const s = sheet({ A99: "=SUM(B2:D4)" });
  s.insertCols("C");
  assert.equal(s.getInput("A99"), "=SUM(B2:E4)");
  s.insertRows(3);
  assert.equal(s.getInput("A100"), "=SUM(B2:E5)");
  s.deleteCols("B");
  assert.equal(s.getInput("A100"), "=SUM(B2:D5)");
  s.deleteRows(2);
  assert.equal(s.getInput("A99"), "=SUM(B2:D4)");
});

test("cp25h recalculation after a column change", () => {
  const s = sheet({ B1: "2", C1: "=B1*3", D1: "=C1+1" });
  assert.equal(s.get("D1"), 7);
  const before = s.stats().evaluations;
  s.insertCols("C");
  assert.equal(s.getInput("E1"), "=D1+1");
  assert.equal(s.get("E1"), 7);
  assert.equal(s.stats().evaluations - before, 2);
  assert.deepEqual(s.dependents("D1"), ["E1"]);
  s.deleteCols("B");
  assert.ok(isErr(s.get("D1"), "#REF!", "C1"));
  assert.equal(s.getInput("C1"), "=#REF!*3");
});
