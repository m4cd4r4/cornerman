// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook, loadWorkbook } from "../../src/index.mjs";

const err = (v) => (v && typeof v === "object" ? `${v.code}@${v.cell}` : v);
function val(f, setup = {}, opts) {
  const s = createSheet(opts);
  for (const [k, v] of Object.entries(setup)) s.set(k, v);
  s.set("D4", f);
  return err(s.get("D4"));
}

test("cp57h numbers round half to even on the decimal form", () => {
  assert.equal(val('=TEXT(1.005, "0.00")'), "1.00");
  assert.equal(val('=TEXT(0.125, "0.00")'), "0.12");
  assert.equal(val('=TEXT(0.135, "0.00")'), "0.14");
  assert.equal(val('=TEXT(2.5, "0")'), "2");
  assert.equal(val('=TEXT(3.5, "0")'), "4");
  assert.equal(val('=TEXT(-2.5, "0")'), "-2");
  assert.equal(val('=TEXT(999.995, "#,##0.00")'), "1,000.00");
  assert.equal(val('=TEXT(1/3, "0.0000000000")'), "0.3333333333");
  assert.equal(val('=TEXT(0.1+0.2, "0.00000")'), "0.30000");
});

test("cp57h percent, grouping, places and the sign of zero", () => {
  assert.equal(val('=TEXT(0.575, "0%")'), "58%");
  assert.equal(val('=TEXT(0.1234, "0.0%")'), "12.3%");
  assert.equal(val('=TEXT(1234.5, "#,##0%")'), "123,450%");
  assert.equal(val('=TEXT(1234567.891, "#,##0.00")'), "1,234,567.89");
  assert.equal(val('=TEXT(999999.5, "#,##0")'), "1,000,000");
  assert.equal(val('=TEXT(-1234.5, "#,##0")'), "-1,234");
  assert.equal(val('=TEXT(5, "0.00")'), "5.00");
  assert.equal(val('=TEXT(-0.004, "0.00")'), "0.00");
  assert.equal(val('=TEXT(-0.0051, "0.00")'), "-0.01");
  assert.equal(val('=TEXT(-0.5, "0")'), "0");
  assert.equal(val('=TEXT(10^15, "0")'), "##########");
  assert.equal(val('=TEXT(-10^15, "#,##0")'), "##########");
  assert.equal(val('=TEXT(999999999999999, "#,##0")'), "999,999,999,999,999");
});

test("cp57h text is never read as a number", () => {
  assert.equal(val('=TEXT("5", "0.00")'), "5");
  assert.equal(val('=TEXT(A1, "0.00")', { A1: '="5"' }), "5");
  assert.equal(val('=TEXT(A1, "0.00")', { A1: "5" }), "5.00");
  assert.equal(val('=TEXT(A1, "0.00")', { A1: "007" }), "7.00");
  assert.equal(val('=TEXT(A1, "0%")', { A1: "1,5" }), "1,5");
  assert.equal(val('=TEXT(" 2 ", "0")'), " 2 ");
  assert.equal(val('=TEXT(TRUE, "0.00")'), "TRUE");
  assert.equal(val('=TEXT(1=2, "0")'), "FALSE");
  assert.equal(val('=TEXT("", "0")'), "");
});

test("cp57h an empty cell is the number 0", () => {
  assert.equal(val('=TEXT(A1, "0.00")'), "0.00");
  assert.equal(val('=TEXT(A1, "0%")'), "0%");
  assert.equal(val('=TEXT(A1, "#,##0.0")', { A1: '=""' }), "");
  assert.equal(val('=LEN(TEXT(A1, "0.000"))'), 5);
});

test("cp57h the format must be a checkpoint 41 format", () => {
  for (const f of ['""', '"General"', '"0.00 "', '" 0"', '"#,##0."', '"0.00000000000"', '"yyyy-mm-dd"', '"0%%"', '"##0"', '"00"', "TRUE", "0.5", "A1"]) {
    assert.equal(val(`=TEXT(1, ${f})`), "#VALUE!@D4", f);
  }
  assert.equal(val('=TEXT("abc", "bad")'), "#VALUE!@D4");
  assert.equal(val('=TEXT(A1, "bad")'), "#VALUE!@D4");
  assert.equal(val('=TEXT(2.5, 0)'), "2");
  assert.equal(val('=TEXT(3.5, 0)'), "4");
  assert.equal(val('=TEXT(0.5, A1)', { A1: "0.0%" }), "50.0%");
  assert.equal(val('=TEXT(0.5, A1)', { A1: "0" }), "0");
  assert.equal(val('=TEXT(0.5, "0.0"&"%")'), "50.0%");
});

test("cp57h argument count, ranges and errors", () => {
  assert.equal(val("=TEXT(1)"), "#VALUE!@D4");
  assert.equal(val('=TEXT(1, "0", "0")'), "#VALUE!@D4");
  assert.equal(val("=TEXT()"), "#VALUE!@D4");
  assert.equal(val('=TEXT(A1:A2, "0")'), "#VALUE!@D4");
  assert.equal(val('=TEXT(1, A1:A2)', { A1: "0" }), "#VALUE!@D4");
  assert.equal(val('=TEXT(1/0, "bad")'), "#DIV/0!@D4");
  assert.equal(val("=TEXT(1/0, nope)"), "#NAME?@D4");
  assert.equal(val("=TEXT(1/0, nope)", {}, { errorOrder: "first" }), "#DIV/0!@D4");
  assert.equal(val('=TEXT(A1, "0")', { A1: "=1/0" }), "#DIV/0!@A1");
  assert.equal(val('=TEXT(A1, B1)', { A1: "=1/0", B1: "=nope" }), "#NAME?@B1");
  assert.equal(val('=TEXT(5, "0")+1'), "#VALUE!@D4");
  assert.equal(val('=TEXT(5, "0")="5"'), true);
  assert.equal(val('=IFERROR(TEXT(1, "x"), "no")'), "no");
});

test("cp57h cell formats play no part", () => {
  const s = createSheet();
  s.set("A1", "0.5");
  s.setFormat("A1", "0.00");
  s.set("B1", '=TEXT(A1, "0%")');
  s.setFormat("B1", "0.000");
  s.set("B2", '=TEXT(A1, "0.0")');
  s.setFormat("B2", "0%");
  assert.equal(s.display("A1"), "0.50");
  assert.equal(s.get("B1"), "50%");
  assert.equal(s.display("B1"), "50%");
  assert.equal(s.display("B2"), "0.5");
  assert.equal(s.getFormat("B2"), "0%");
  s.set("C1", "1234");
  s.setFormat("C1", "#,##0");
  s.set("C2", '=TEXT(C1, "0")');
  assert.equal(s.toCSV(), '0.50,50%,"1,234"\n,0.5,1234');
});

test("cp57h references move; the format text never does", () => {
  const s = createSheet();
  s.set("A1", "1.25");
  s.set("B1", '=text(a1, "0.0")');
  assert.deepEqual(s.precedents("B1"), ["A1"]);
  s.insertRows(1);
  assert.equal(s.getInput("B2"), '=text(A2, "0.0")');
  assert.equal(s.get("B2"), "1.2");
  s.insertCols("A");
  assert.equal(s.getInput("C2"), '=text(B2, "0.0")');
  s.copy("C2", "C3");
  assert.equal(s.getInput("C3"), '=text(B3, "0.0")');
  assert.equal(s.get("C3"), "0.0");
  s.set("B3", "=1/8");
  assert.equal(s.get("C3"), "0.1");
  assert.equal(s.canonical("C3"), '=TEXT(B3,"0.0")');
  s.deleteCols("B");
  assert.equal(err(s.get("B3")), "#REF!@B3");
  assert.equal(s.undo(), true);
  assert.equal(s.get("C3"), "0.1");
});

test("cp57h the format may come from a cell, a name or a constant, and recalculates", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.set("A1", "0.00");
  m.set("A1", "1234.5");
  m.set("B1", "=TEXT(A1, Data!A1)");
  // The input 0.00 is the number 0, whose display text is the format "0".
  assert.equal(m.get("B1"), "1234");
  d.set("A1", '="0.00"');
  assert.equal(m.get("B1"), "1234.50");
  d.set("A1", "#,##0");
  assert.equal(m.get("B1"), "1,234");
  b.defineConstant("FMT", "0%");
  m.set("B2", "=TEXT(0.5, FMT)");
  assert.equal(m.get("B2"), "50%");
  m.defineConstant("FMT", 0);
  assert.equal(m.get("B2"), "0");
  m.defineName("FMT", "C1:C2");
  assert.equal(err(m.get("B2")), "#VALUE!@B2");
  m.defineName("FMT", "C1");
  m.set("C1", "0.0");
  assert.equal(m.get("B2"), "0");
  m.set("C1", '="0.0"');
  assert.equal(m.get("B2"), "0.5");
  assert.deepEqual(m.precedents("B1"), ["A1", "Data!A1"]);
  b.renameSheet("Data", "Facts");
  assert.equal(m.getInput("B1"), "=TEXT(A1, Facts!A1)");
  assert.equal(m.get("B1"), "1,234");
});

test("cp57h saved as typed and loaded the same", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  m.set("A1", "0.125");
  m.set("A2", '=TEXT(A1, "0.00")');
  m.setFormat("A1", "0%");
  const c = loadWorkbook(b.save());
  assert.equal(c.sheet("Main").getInput("A2"), '=TEXT(A1, "0.00")');
  assert.equal(c.sheet("Main").get("A2"), "0.12");
  assert.equal(c.sheet("Main").display("A1"), "12%");
  assert.equal(c.save(), b.save());
});

test("cp57h CHANGES.md has a cp57 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 57);
  assert.match(lines[56], /^- cp57: \S/);
  assert.notEqual(lines[56].slice(8).toLowerCase(), "text");
});

test("cp57h recall: an invalid range in either argument is #REF! before it is a range, a valid one is #VALUE!", () => {
  assert.equal(val('=TEXT(A0:A3, "0")'), "#REF!@D4");
  assert.equal(val('=TEXT(A1:A3, "0")'), "#VALUE!@D4");
  assert.equal(val("=TEXT(1, A0:A3)"), "#REF!@D4");
});
