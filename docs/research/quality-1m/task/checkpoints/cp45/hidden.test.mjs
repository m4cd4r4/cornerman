// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const isErr = (v, code, cell) => v && typeof v === "object" && v.code === code && v.cell === cell && typeof v.message === "string" && v.message.length > 0;
function sheet() {
  const s = createSheet();
  s.fromCSV("1,2,3\n4,5,6", "A1");
  s.fromCSV("10,20,30\n40,50,60", "A4");
  s.set("E1", "=TRUE");
  s.set("E2", "=FALSE");
  s.set("F1", "5");
  s.set("F2", "7");
  s.set("G1", '="5"');
  s.set("G2", "x");
  return s;
}
function val(f, s = sheet()) {
  s.set("Z99", f);
  return s.get("Z99");
}

test("cp45h products of 2-D ranges in position order", () => {
  assert.equal(val("=SUMPRODUCT(A1:C2, A4:C5)"), 910);
  assert.equal(val("=SUMPRODUCT(A1:C2)"), 21);
  assert.equal(val("=SUMPRODUCT(C2:A1, A4:C5)"), 910);
  assert.equal(val("=SUMPRODUCT(A1:C1, A2:C2, A4:C4)"), 1 * 4 * 10 + 2 * 5 * 20 + 3 * 6 * 30);
  assert.equal(val("=SUMPRODUCT(A1)"), 1);
  assert.equal(val("=SUMPRODUCT(A1, F1)"), 5);
  const s = sheet();
  s.set("H1", "0.1");
  s.set("H2", "0.2");
  s.set("I1", "1");
  s.set("I2", "1");
  assert.equal(val("=SUMPRODUCT(H1:H2, I1:I2)", s), 0.1 + 0.2);
});

test("cp45h booleans count as 1 and 0; text and empty as 0", () => {
  assert.equal(val("=SUMPRODUCT(E1:E2, F1:F2)"), 5);
  assert.equal(val("=SUMPRODUCT(E1:E2)"), 1);
  assert.equal(val("=SUMPRODUCT(G1:G2, F1:F2)"), 0);
  assert.equal(val("=SUMPRODUCT(Q1:Q2, F1:F2)"), 0);
  assert.equal(val("=SUMPRODUCT(E1:F2)"), 1 + 5 + 7);
  const s = sheet();
  s.set("G1", '=""');
  assert.equal(val("=SUMPRODUCT(G1:G2, F1:F2)", s), 0);
});

test("cp45h every argument must be a range argument and is not evaluated", () => {
  for (const f of ["=SUMPRODUCT((A1:A2>1)*F1:F2)", "=SUMPRODUCT(2, 3)", "=SUMPRODUCT()", "=SUMPRODUCT(1/0)", "=SUMPRODUCT(A1:A2, 2)", "=SUMPRODUCT(A1:A2*2)", "=SUMPRODUCT(-A1:A2)", '=SUMPRODUCT("A1:A2")', "=SUMPRODUCT(F1:F2, SUM(F1:F2))", "=SUMPRODUCT(F1:F2, Q9:Q9/0)"]) {
    assert.ok(isErr(val(f), "#VALUE!", "Z99"), f);
  }
  assert.ok(isErr(val("=SUMPRODUCT(A0:A2)"), "#REF!", "Z99"));
  assert.ok(isErr(val("=SUMPRODUCT(NOPE, 1/0)"), "#NAME?", "Z99"));
  assert.ok(isErr(val("=SUMPRODUCT(1/0, NOPE)"), "#NAME?", "Z99"));
  assert.ok(isErr(val("=SUMPRODUCT(NOPE, A0:A1)"), "#REF!", "Z99"));
  assert.ok(isErr(val("=SUMPRODUCT(A1:A2, B1:C2, NOPE)"), "#NAME?", "Z99"));
});

test("cp45h shapes must match", () => {
  for (const f of ["=SUMPRODUCT(A1:C2, A4:B5)", "=SUMPRODUCT(A1:A2, A1:B1)", "=SUMPRODUCT(A1:C1, A4:C5)", "=SUMPRODUCT(A1:A2, A4:A6)", "=SUMPRODUCT(A1, A1:A2)"]) {
    assert.ok(isErr(val(f), "#VALUE!", "Z99"), f);
  }
  assert.equal(val("=SUMPRODUCT(A1:B1, A4:B4)"), 10 + 40);
});

test("cp45h errors anywhere win by priority", () => {
  const s = sheet();
  s.set("H1", "=1/0");
  s.set("H2", "=FOO()");
  s.set("I2", "=1/0");
  s.set("J1", "=Q1+#REF!");
  assert.ok(isErr(val("=SUMPRODUCT(F1:F2, H1:H2)", s), "#NAME?", "H2"));
  assert.ok(isErr(val("=SUMPRODUCT(F1:F2, I1:I2)", s), "#DIV/0!", "I2"));
  assert.ok(isErr(val("=SUMPRODUCT(I1:I2, H1:H2)", s), "#NAME?", "H2"));
  assert.ok(isErr(val("=SUMPRODUCT(Q1:Q2, I1:I2)", s), "#DIV/0!", "I2"));
  assert.ok(isErr(val("=SUMPRODUCT(H1:I2, J1:K2)", s), "#REF!", "J1"));
  assert.ok(isErr(val("=SUMPRODUCT(H1:H2, A1:C1)", s), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=SUMPRODUCT(E1:E2, H1:H2)", s), "#NAME?", "H2"));
});

test("cp45h names, precedents, cycles", () => {
  const s = sheet();
  s.defineName("QTY", "A1:A2");
  s.defineName("PRICE", "F1:F2");
  s.set("Z1", "=SUMPRODUCT(QTY, PRICE)");
  assert.equal(s.get("Z1"), 1 * 5 + 4 * 7);
  assert.deepEqual(s.precedents("Z1"), ["A1", "F1", "A2", "F2"]);
  s.set("A2", "10");
  assert.equal(s.get("Z1"), 75);
  s.set("F3", "=SUMPRODUCT(F1:F3)");
  assert.ok(isErr(s.get("F3"), "#CYCLE!", "F3"));
});

test("cp45h insert and delete rewrite each range on its own", () => {
  const s = createSheet();
  s.fromCSV("1,2,,3,4\n5,6,,7,8", "A1");
  s.set("A4", "=SUMPRODUCT(A1:B2, D1:E2)");
  assert.equal(s.get("A4"), 3 + 8 + 35 + 48);
  s.insertRows(2, 1);
  assert.equal(s.getInput("A5"), "=SUMPRODUCT(A1:B3, D1:E3)");
  assert.equal(s.get("A5"), 94);
  s.deleteCols("B", 1);
  assert.equal(s.getInput("A5"), "=SUMPRODUCT(A1:A3, C1:D3)");
  assert.ok(isErr(s.get("A5"), "#VALUE!", "A5"));
  s.undo();
  assert.equal(s.get("A5"), 94);
});

test("cp45h ranges on other sheets", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.fromCSV("2,3\n4,5", "A1");
  m.fromCSV("10\n100", "A1");
  m.set("B1", "=SUMPRODUCT(A1:A2, Data!B1:B2)");
  m.set("B2", "=SUMPRODUCT(A1:A2, Gone!B1:B2)");
  assert.equal(m.get("B1"), 530);
  assert.ok(isErr(m.get("B2"), "#REF!", "B2"));
  d.set("B2", "=TRUE");
  assert.equal(m.get("B1"), 130);
});

test("cp45h CHANGES.md has a cp45 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 45);
  assert.match(lines[44], /^- cp45: \S/);
  assert.notEqual(lines[44].slice(8).toLowerCase(), "sumproduct");
});

test("cp45h recall: an error read from a range on another sheet keeps its own cell, with no sheet name", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.set("A1", "2");
  d.set("C5", "=1/0");
  m.set("B2", "=SUMPRODUCT(Data!A1:C5)");
  assert.ok(isErr(m.get("B2"), "#DIV/0!", "C5"));
});
