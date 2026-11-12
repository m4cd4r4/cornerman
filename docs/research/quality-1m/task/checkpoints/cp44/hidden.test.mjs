// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const isErr = (v, code, cell) => v && typeof v === "object" && v.code === code && v.cell === cell && typeof v.message === "string" && v.message.length > 0;
// A1:C3 a table; A5:A9 an unsorted column with a repeat; B5:F5 a row.
function sheet() {
  const s = createSheet();
  s.fromCSV("10,ant,x\n20,bee,y\n30,cat,z", "A1");
  s.fromCSV("30\n5\n20\n30\napple", "A5");
  s.fromCSV("b,a,c,b,TRUE", "B5");
  s.set("F5", "=TRUE");
  return s;
}
function val(f, s = sheet()) {
  s.set("Z99", f);
  return s.get("Z99");
}

test("cp44h INDEX: the second argument is always the row", () => {
  assert.equal(val("=INDEX(A1:C3, 2)"), 20);
  assert.equal(val("=INDEX(A1:C3, 3, 2)"), "cat");
  assert.ok(isErr(val("=INDEX(A1:C1, 2)"), "#REF!", "Z99"));
  assert.equal(val("=INDEX(A1:C1, 1, 2)"), "ant");
  assert.equal(val("=INDEX(B5:F5, 1, 3)"), "c");
  assert.equal(val("=INDEX(A1:C3, 2.9, 1.9)"), 20);
});

test("cp44h INDEX: positions outside the range, zero included, are #REF!", () => {
  for (const f of ["=INDEX(A1:C3, 0, 1)", "=INDEX(A1:C3, 1, 0)", "=INDEX(A1:C3, 4)", "=INDEX(A1:C3, 1, 4)", "=INDEX(A1:C3, -1)", "=INDEX(A1:C3, 0.9)", "=INDEX(A1:C3, -0.5, 1)"]) {
    assert.ok(isErr(val(f), "#REF!", "Z99"), f);
  }
});

test("cp44h INDEX: values as a reference gives them", () => {
  const s = sheet();
  s.set("D1", "=1/0");
  s.set("D3", "0.5");
  s.setFormat("D3", "0%");
  assert.equal(val("=INDEX(D1:D3, 2)", s), 0);
  assert.equal(s.display("Z99"), "0");
  assert.ok(isErr(val("=INDEX(D1:D3, 1)", s), "#DIV/0!", "D1"));
  assert.equal(val("=INDEX(D1:D3, 3)", s), 0.5);
  assert.equal(s.display("Z99"), "0.5");
  assert.equal(val('=INDEX(D1:D3, 2)&"x"', s), "x");
  assert.equal(val("=INDEX(A1, 1, 1)", s), 10);
  assert.equal(val("=IFERROR(INDEX(A1:A3, 9), -1)", s), -1);
});

test("cp44c chat: MATCH without a type is an exact match", () => {
  assert.equal(val("=MATCH(20, A5:A9)"), 3);
  assert.ok(isErr(val("=MATCH(25, A5:A9)"), "#N/A", "Z99"));
  assert.ok(isErr(val("=MATCH(25, A1:A3)"), "#N/A", "Z99"));
});

test("cp44h MATCH type 0: first equal cell, tolerance, case ignored, booleans", () => {
  assert.equal(val("=MATCH(20, A5:A9, 0)"), 3);
  assert.equal(val("=MATCH(30, A5:A9, 0)"), 1);
  assert.equal(val('=MATCH("APPLE", A5:A9, 0)'), 5);
  assert.equal(val('=MATCH("b", B5:F5, 0)'), 1);
  assert.equal(val("=MATCH(TRUE, B5:F5, 0)"), 5);
  assert.equal(val("=MATCH(30.0000000001, A5:A9, 0)"), 1);
});

test("cp44h MATCH types 1 and -1 search the whole range, first on ties", () => {
  assert.equal(val("=MATCH(25, A5:A9, 1)"), 3);
  assert.equal(val("=MATCH(25, A5:A9, -1)"), 1);
  assert.equal(val("=MATCH(30, A5:A9, 1)"), 1);
  assert.equal(val("=MATCH(100, A5:A9, 1)"), 1);
  assert.equal(val("=MATCH(6, A5:A9, -1)"), 3);
  assert.ok(isErr(val("=MATCH(1, A5:A9, 1)"), "#N/A", "Z99"));
  assert.equal(val("=MATCH(1, A5:A9, -1)"), 2);
  assert.ok(isErr(val("=MATCH(31, A5:A9, -1)"), "#N/A", "Z99"));
  assert.equal(val('=MATCH("bb", B5:F5, 1)'), 1);
  assert.equal(val('=MATCH("B", B5:F5, -1)'), 1);
  assert.equal(val('=MATCH("a", B5:F5, -1)'), 2);
  assert.equal(val("=MATCH(25, A5:A9, 1.7)"), 3);
  assert.equal(val("=MATCH(25, A5:A9, -1.7)"), 1);
});

test("cp44h MATCH is type-strict and literal", () => {
  assert.ok(isErr(val('=MATCH("20", A5:A9, 0)'), "#N/A", "Z99"));
  assert.ok(isErr(val('=MATCH("a*", A5:A9, 0)'), "#N/A", "Z99"));
  assert.ok(isErr(val('=MATCH("?", B5:F5, 0)'), "#N/A", "Z99"));
  assert.ok(isErr(val('=MATCH("TRUE", B5:F5, 0)'), "#N/A", "Z99"));
  assert.ok(isErr(val("=MATCH(1, B5:F5, 1)"), "#N/A", "Z99"));
  assert.ok(isErr(val("=MATCH(Q1, A5:A9, 0)"), "#N/A", "Z99"));
  assert.ok(isErr(val("=MATCH(Q1, Q1:Q5, 0)"), "#N/A", "Z99"));
  const s = sheet();
  s.set("A6", "=1/0");
  s.set("A7", '=""');
  assert.equal(val("=MATCH(30, A5:A9, -1)", s), 1);
  assert.equal(val('=MATCH("", A5:A9, 0)', s), 3);
  assert.ok(isErr(val("=MATCH(5, A5:A9, 0)", s), "#N/A", "Z99"));
});

test("cp44h arguments and their errors", () => {
  for (const f of ["=MATCH(20, A1:C3)", "=MATCH(20, A5:A9, 2)", "=MATCH(20, A5:A9, -2)", "=MATCH(20)", "=MATCH(20, A5:A9, 0, 0)", "=MATCH(20, 5)", "=INDEX(5, 1)", "=INDEX(A1:C3)", "=INDEX(A1:C3, 1, 1, 1)", '=INDEX(A1:C3, "x")', "=INDEX(A1+1, 1)"]) {
    assert.ok(isErr(val(f), "#VALUE!", "Z99"), f);
  }
  assert.ok(isErr(val("=INDEX(A0:A3, 1)"), "#REF!", "Z99"));
  assert.ok(isErr(val("=INDEX(NOPE, 1/0)"), "#NAME?", "Z99"));
  assert.ok(isErr(val("=MATCH(1/0, NOPE)"), "#NAME?", "Z99"));
  assert.ok(isErr(val("=MATCH(1/0, A5:A9, 7)"), "#DIV/0!", "Z99"));
  assert.ok(isErr(val("=INDEX(A1:C3, 1/0, 9)"), "#DIV/0!", "Z99"));
  assert.equal(val("=INDEX(A1:C3, TRUE, TRUE)"), 10);
});

test("cp44h precedents, recalculation, insert and other sheets", () => {
  const s = sheet();
  s.set("E1", '=INDEX(A1:B2, MATCH("bee", B1:B2, 0), 1)');
  assert.equal(s.get("E1"), 20);
  assert.deepEqual(s.precedents("E1"), ["A1", "B1", "A2", "B2"]);
  s.set("B1", "bee");
  assert.equal(s.get("E1"), 10);
  s.insertRows(2, 1);
  assert.equal(s.getInput("E1"), '=INDEX(A1:B3, MATCH("bee", B1:B3, 0), 1)');
  assert.equal(s.get("E1"), 10);
  s.set("E2", "=MATCH(E2, A1:A3, 0)");
  assert.ok(isErr(s.get("E2"), "#CYCLE!", "E2"));
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.fromCSV("k1,5\nk2,6", "A1");
  m.set("A1", '=INDEX(Data!B1:B2, MATCH("K2", Data!A1:A2, 0))');
  assert.equal(m.get("A1"), 6);
  d.set("B2", "7");
  assert.equal(m.get("A1"), 7);
  m.set("A2", "=INDEX(Gone!A1:A2, 1)");
  assert.ok(isErr(m.get("A2"), "#REF!", "A2"));
});

test("cp44h CHANGES.md has a cp44 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 44);
  assert.match(lines[43], /^- cp44: \S/);
  assert.notEqual(lines[43].slice(8).toLowerCase(), "index and match");
});

test("cp44h recall: row and column read as in arithmetic, so text is #VALUE! even when it looks like a number", () => {
  const s = sheet();
  s.set("Y1", '="2"');
  assert.ok(isErr(val('=INDEX(A1:C3, "2")', s), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=INDEX(A1:C3, Y1)", s), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=INDEX(A1:C3, 1, Y1)", s), "#VALUE!", "Z99"));
  assert.equal(val("=INDEX(A1:C3, TRUE, TRUE)", s), 10);
});
