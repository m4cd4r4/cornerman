// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell;
const n = (address, input, value, from) => ({ address, input, value, from });
const cyc = (cell) => ({ code: "#CYCLE!", cell, message: "circular reference" });

test("cp39h repeats, empty cells, ranges, names", () => {
  const s = createSheet();
  s.set("A1", "=B1+C1+B1");
  s.set("B1", "=C1*2");
  s.set("C1", "3");
  s.set("D1", "=SUM(E1:E3)");
  s.set("E2", "5");
  s.defineName("RATE", "C1");
  s.set("I1", "=RATE*2");
  s.set("J1", "=IF(TRUE, 1, C1)");
  s.set("K1", "=1+2");
  s.set("K2", "text");
  const a1 = s.explain("A1");
  assert.deepEqual(Object.keys(a1), ["address", "input", "value", "from"]);
  assert.deepEqual(a1, n("A1", "=B1+C1+B1", 15, [n("B1", "=C1*2", 6, [n("C1", "3", 3, [])]), n("C1", "3", 3, null)]));
  assert.deepEqual(s.explain("c1"), n("C1", "3", 3, []));
  assert.deepEqual(s.explain("Z9"), n("Z9", null, null, []));
  assert.deepEqual(s.explain("D1"), n("D1", "=SUM(E1:E3)", 5, [n("E1", null, null, []), n("E2", "5", 5, []), n("E3", null, null, [])]));
  assert.deepEqual(s.explain("I1"), n("I1", "=RATE*2", 6, [n("C1", "3", 3, [])]));
  assert.deepEqual(s.explain("J1"), n("J1", "=IF(TRUE, 1, C1)", 1, [n("C1", "3", 3, [])]));
  assert.deepEqual(s.explain("K1"), n("K1", "=1+2", 3, []));
  assert.deepEqual(s.explain("K2"), n("K2", "text", "text", []));
  assert.throws(() => s.explain("A0"), thrown("#ADDR", "A0"));
});

test("cp39h cycles and errors", () => {
  const s = createSheet();
  s.set("F1", "=G1");
  s.set("G1", "=F1");
  s.set("A1", "=A1+1");
  s.set("H1", "=1/0");
  s.set("H2", "=H1+H1");
  assert.deepEqual(s.explain("F1"), n("F1", "=G1", cyc("F1"), [n("G1", "=F1", cyc("G1"), [n("F1", "=G1", cyc("F1"), null)])]));
  assert.deepEqual(s.explain("A1"), n("A1", "=A1+1", cyc("A1"), [n("A1", "=A1+1", cyc("A1"), null)]));
  const div = { code: "#DIV/0!", cell: "H1", message: "division by zero" };
  assert.deepEqual(s.explain("H2"), n("H2", "=H1+H1", div, [n("H1", "=1/0", div, [])]));
});

test("cp39h deeper repeats keep depth-first order", () => {
  const s = createSheet();
  s.set("A1", "=B1+C1");
  s.set("B1", "=D1");
  s.set("C1", "=D1+B1");
  s.set("D1", "=E1");
  s.set("E1", "1");
  assert.deepEqual(
    s.explain("A1"),
    n("A1", "=B1+C1", 3, [
      n("B1", "=D1", 1, [n("D1", "=E1", 1, [n("E1", "1", 1, [])])]),
      n("C1", "=D1+B1", 2, [n("B1", "=D1", 1, null), n("D1", "=E1", 1, null)]),
    ]),
  );
});

test("cp39h across sheets: labels from the top sheet, order from the cell's sheet", () => {
  const b = createWorkbook();
  const zed = b.addSheet("Zed");
  const ann = b.addSheet("Ann");
  const mid = b.addSheet("Mid");
  mid.set("A1", "=Ann!B1+Zed!A2+B9+Zed!A1+A3");
  ann.set("B1", "=A1+Mid!A3+Zed!A1");
  zed.set("A1", "1");
  mid.set("A3", "=Ann!A1");
  mid.set("B1", "=Nope!A1+Mid!B2");
  assert.deepEqual(
    mid.explain("A1"),
    n("A1", "=Ann!B1+Zed!A2+B9+Zed!A1+A3", 2, [
      n("A3", "=Ann!A1", 0, [n("Ann!A1", null, null, [])]),
      n("B9", null, null, []),
      n("Zed!A1", "1", 1, []),
      n("Zed!A2", null, null, []),
      n("Ann!B1", "=A1+Mid!A3+Zed!A1", 1, [n("Ann!A1", null, null, null), n("Zed!A1", "1", 1, null), n("A3", "=Ann!A1", 0, null)]),
    ]),
  );
  assert.deepEqual(
    ann.explain("B1"),
    n("B1", "=A1+Mid!A3+Zed!A1", 1, [n("A1", null, null, []), n("Zed!A1", "1", 1, []), n("Mid!A3", "=Ann!A1", 0, [n("A1", null, null, null)])]),
  );
  const ref = mid.explain("B1");
  assert.equal(ref.value.code, "#REF!");
  assert.deepEqual(ref.from, [n("B2", null, null, [])]);
  b.renameSheet("Zed", "Alpha");
  assert.equal(mid.explain("A1").from[2].address, "Alpha!A1");
});

test("cp39h reads like get, records nothing", () => {
  const s = createSheet();
  s.set("C1", "3");
  s.set("B1", "=C1*2");
  s.set("A1", "=B1+C1");
  assert.equal(s.stats().evaluations, 0);
  s.explain("A1");
  assert.equal(s.stats().evaluations, 2);
  s.explain("A1");
  assert.equal(s.stats().evaluations, 2);
  assert.equal(s.getInput("A1"), "=B1+C1");
  assert.equal(s.undo(), true);
  assert.equal(s.getInput("A1"), null);
  assert.equal(s.redo(), true);
  assert.equal(s.redo(), false);
});

test("cp39h a 9,999-cell chain explains without throwing", () => {
  const s = createSheet();
  s.set("A1", "1");
  for (let i = 2; i <= 9999; i++) s.set(`A${i}`, `=A${i - 1}+1`);
  let node = s.explain("A9999");
  assert.equal(node.value, 9999);
  let depth = 0;
  while (node.from.length) {
    assert.equal(node.from.length, 1);
    node = node.from[0];
    depth++;
  }
  assert.equal(depth, 9998);
  assert.deepEqual(node, n("A1", "1", 1, []));
});

test("cp39h recall: from lists the precedents in the row-major order of checkpoint 10, Z before AA", () => {
  const s = createSheet();
  s.set("D3", "=A10+A2+AA1+B1+Z1");
  assert.deepEqual(s.explain("D3").from.map((n) => n.address), ["B1", "Z1", "AA1", "A2", "A10"]);
  assert.deepEqual(s.explain("D3").from.map((n) => n.address), s.precedents("D3"));
});
