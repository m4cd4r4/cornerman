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
// The formula sits in Z20; it ends up `count` rows higher.
function after(formula, at, count = 1) {
  const s = sheet({ Z20: formula });
  s.deleteRows(at, count);
  return s.getInput("Z" + (20 - count));
}
const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;

test("cp24h deleted cells are gone and cells below move up", () => {
  const s = sheet({ A1: "1", A2: "2", A3: "3", A4: "4", B9: "x" });
  s.deleteRows(2, 2);
  assert.deepEqual(s.cells(), ["A1", "A2", "B7"]);
  assert.equal(s.get("A2"), 4);
  assert.equal(s.get("A4"), null);
  assert.equal(s.getInput("B7"), "x");
});

test("cp24h single references", () => {
  assert.equal(after("=A3*2", 3), "=#REF!*2");
  assert.equal(after("=A5", 3), "=A4");
  assert.equal(after("=A2", 3), "=A2");
  assert.equal(after("=A3+A4+A9", 3, 2), "=#REF!+#REF!+A7");
  const s = sheet({ Z1: "=A3*2" });
  s.deleteRows(3);
  assert.ok(isErr(s.get("Z1"), "#REF!", "Z1"));
});

test("cp24h ranges shrink, and a wholly deleted range is #REF!", () => {
  assert.equal(after("=SUM(A2:A5)", 3), "=SUM(A2:A4)");
  assert.equal(after("=SUM(A2:A5)", 1, 2), "=SUM(A1:A3)");
  assert.equal(after("=SUM(A2:A5)", 4, 3), "=SUM(A2:A3)");
  assert.equal(after("=SUM(A2:A5)", 2, 4), "=SUM(#REF!)");
  assert.equal(after("=SUM(A2:A5)", 1, 6), "=SUM(#REF!)");
  assert.equal(after("=SUM(A2:A5)", 6), "=SUM(A2:A5)");
  assert.equal(after("=SUM(A2:A5)", 1), "=SUM(A1:A4)");
  assert.equal(after("=SUM(A5:A2)", 2), "=SUM(A4:A2)");
  assert.equal(after("=SUM(A5:A2)", 5), "=SUM(A4:A2)");
  assert.equal(after("=SUM(B2:C5)", 3, 2), "=SUM(B2:C3)");
});

test("cp24h values follow the deletion", () => {
  const s = sheet({ A2: "1", A3: "2", A4: "3", A5: "4", Z1: "=SUM(A2:A5)", Z2: "=COUNT(A3:A4)" });
  assert.equal(s.get("Z1"), 10);
  assert.equal(s.get("Z2"), 2);
  const before = s.stats().evaluations;
  s.deleteRows(3);
  assert.equal(s.get("Z1"), 8);
  assert.equal(s.getInput("Z2"), "=COUNT(A3:A3)");
  assert.equal(s.get("Z2"), 1);
  assert.equal(s.stats().evaluations - before, 2);
  s.deleteRows(2, 3);
  assert.ok(isErr(s.get("Z1"), "#REF!", "Z1"));
});

test("cp24h text outside moved references stays as typed", () => {
  assert.equal(after('=sum(a6:a2) & "A6" & a1 & LOG10(1)', 3), '=sum(A5:a2) & "A6" & a1 & LOG10(1)');
  assert.equal(after("=a3 + 1", 3), "=#REF! + 1");
  assert.equal(after("=A5+", 2), "=A5+");
});

test("cp24h names move, shrink, or are removed", () => {
  const s = sheet({ A2: "5", A5: "7", Z1: "=SUM(R)" });
  s.defineName("R", "A3:A5");
  s.defineName("GONE", "A2:A3");
  s.defineName("ONE", "A2");
  s.defineName("LOW", "B9");
  s.defineName("TOP", "A1");
  s.deleteRows(2, 2);
  assert.deepEqual(s.names(), { LOW: "B7", R: "A2:A3", TOP: "A1" });
  assert.equal(s.get("Z1"), 7);
});

test("cp24h bad arguments throw and change nothing", () => {
  const s = sheet({ A2: "1", B1: "=A2" });
  for (const [at, count] of [[0, 1], [10000, 1], [9999, 2], [2, 0], [2.5, 1], ["2", 1], [1, 1.5]]) {
    assert.throws(() => s.deleteRows(at, count), thrown("#ARG", String(at)), `${at} ${count}`);
  }
  assert.deepEqual(s.cells(), ["B1", "A2"]);
  assert.equal(s.getInput("B1"), "=A2");
  s.deleteRows(9999);
  assert.deepEqual(s.cells(), ["B1", "A2"]);
});

test("cp24h cycles and dependents follow the new text", () => {
  const s = sheet({ A1: "=A3", A3: "=A1" });
  s.deleteRows(2);
  assert.equal(s.getInput("A2"), "=A1");
  assert.ok(isErr(s.get("A1"), "#CYCLE!", "A1"));
  const t = sheet({ A1: "=A3", A3: "=A1", A5: "=A1+1" });
  t.deleteRows(3);
  assert.equal(t.getInput("A1"), "=#REF!");
  assert.ok(isErr(t.get("A1"), "#REF!", "A1"));
  assert.ok(isErr(t.get("A4"), "#REF!", "A1"));
  assert.deepEqual(t.dependents("A1"), ["A4"]);
});
