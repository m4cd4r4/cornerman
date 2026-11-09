// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
function shown(input, format) {
  const s = createSheet();
  s.set("C3", input);
  s.setFormat("C3", format);
  return s.display("C3");
}

test("cp41h rounding is half to even on the decimal form", () => {
  assert.equal(shown("1.005", "0.00"), "1.00");
  assert.equal(shown("0.125", "0.00"), "0.12");
  assert.equal(shown("0.135", "0.00"), "0.14");
  assert.equal(shown("2.5", "0"), "2");
  assert.equal(shown("3.5", "0"), "4");
  assert.equal(shown("-1.5", "0"), "-2");
  assert.equal(shown("-2.5", "0"), "-2");
  assert.equal(shown("999.995", "#,##0.00"), "1,000.00");
  assert.equal(shown("=1/3", "0.0000000000"), "0.3333333333");
  assert.equal(shown("=0.1+0.2", "0.00000"), "0.30000");
});

test("cp41h percent moves the digits", () => {
  assert.equal(shown("0.575", "0%"), "58%");
  assert.equal(shown("0.125", "0%"), "12%");
  assert.equal(shown("0.1234", "0.0%"), "12.3%");
  assert.equal(shown("12", "0.00%"), "1200.00%");
  assert.equal(shown("0", "0%"), "0%");
  assert.equal(shown("1234.5", "#,##0%"), "123,450%");
});

test("cp41h places, grouping and the sign of zero", () => {
  assert.equal(shown("5", "0.00"), "5.00");
  assert.equal(shown("0", "0.000"), "0.000");
  assert.equal(shown("0.00001", "0.0000000000"), "0.0000100000");
  assert.equal(shown("1234567.891", "#,##0.00"), "1,234,567.89");
  assert.equal(shown("123", "#,##0"), "123");
  assert.equal(shown("1234", "#,##0"), "1,234");
  assert.equal(shown("999999.5", "#,##0"), "1,000,000");
  assert.equal(shown("-1234.5", "#,##0"), "-1,234");
  assert.equal(shown("1234", "0"), "1234");
  assert.equal(shown("-0.004", "0.00"), "0.00");
  assert.equal(shown("-0.005", "0.00"), "0.00");
  assert.equal(shown("-0.0051", "0.00"), "-0.01");
  assert.equal(shown("-0.5", "0"), "0");
  assert.equal(shown("-0.2", "0%"), "-20%");
});

test("cp41h only numbers are formatted", () => {
  assert.equal(shown("=TRUE", "0.00"), "TRUE");
  assert.equal(shown("abc", "0%"), "abc");
  assert.equal(shown('="5"', "0.00"), "5");
  assert.equal(shown("=1/0", "0.00"), "#DIV/0!");
  assert.equal(shown("=10^15", "0.00"), "##########");
  assert.equal(shown("=-10^15", "#,##0"), "##########");
  assert.equal(shown("999999999999999", "#,##0"), "999,999,999,999,999");
  const s = createSheet();
  s.setFormat("A1", "0.00");
  assert.equal(s.display("A1"), "");
  assert.equal(s.getFormat("A1"), "0.00");
});

test("cp41h format grammar and errors, in order, changing nothing", () => {
  const s = createSheet();
  s.set("A1", "2");
  s.setFormat("A1", "0.0");
  for (const bad of ["0.0.0", "#,##0.", "0.00000000000", "%", "##0", "General", "0 %", " 0", "0.00 ", "#,##0,", "0%%", "00", "#,#0", 5, true, undefined]) {
    assert.throws(() => s.setFormat("A1", bad), thrown("#FORMAT", String(bad)), String(bad));
  }
  assert.throws(() => s.setFormat("A0", "0"), thrown("#ADDR", "A0"));
  assert.throws(() => s.setFormat("A1:B", "0"), thrown("#ADDR", "A1:B"));
  assert.throws(() => s.setFormat("A1:B2:C3", "0"), thrown("#ADDR", "A1:B2:C3"));
  assert.throws(() => s.setFormat(null, "0"), thrown("#ADDR", "null"));
  assert.throws(() => s.setFormat("A0", "bad"), thrown("#ADDR", "A0"));
  assert.throws(() => s.setFormat("A1:Z9999", "bad"), thrown("#ARG", "A1:Z9999"));
  assert.throws(() => s.getFormat("1A"), thrown("#ADDR", "1A"));
  assert.equal(s.display("A1"), "2.0");
  assert.equal(s.getFormat("B1"), null);
  s.setFormat("b2:a1", "0.00000000%");
  assert.equal(s.getFormat("A1"), "0.00000000%");
  assert.equal(s.getFormat("B2"), "0.00000000%");
  s.setFormat("A1:B2", "");
  assert.equal(s.getFormat("A1"), null);
  assert.equal(s.display("A1"), "2");
});

test("cp41h the value is unchanged; formulas get no format", () => {
  const s = createSheet();
  s.set("A1", "0.5");
  s.setFormat("A1", "0%");
  s.set("B1", '=A1&""');
  s.set("C1", "=A1");
  s.set("D1", "=A1*2");
  assert.equal(s.get("A1"), 0.5);
  assert.equal(s.display("A1"), "50%");
  assert.equal(s.get("B1"), "0.5");
  assert.equal(s.display("C1"), "0.5");
  assert.equal(s.getFormat("C1"), null);
  assert.equal(s.display("D1"), "1");
  assert.equal(s.text("A1"), "50%");
  s.set("A1", "");
  assert.equal(s.getFormat("A1"), "0%");
  assert.equal(s.display("A1"), "");
  s.set("A1", "0.3");
  assert.equal(s.display("A1"), "30%");
});

test("cp41h undo: one step per call, no-op calls not recorded", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.setFormat("A1:C3", "0.00");
  s.setFormat("A1:C3", "0.00");
  s.setFormat("B2", "0%");
  assert.equal(s.undo(), true);
  assert.equal(s.getFormat("B2"), "0.00");
  assert.equal(s.undo(), true);
  assert.equal(s.getFormat("A1"), null);
  assert.equal(s.getFormat("C3"), null);
  assert.equal(s.getInput("A1"), "1");
  assert.equal(s.redo(), true);
  assert.equal(s.getFormat("C3"), "0.00");
  assert.equal(s.display("A1"), "1.00");
  s.setFormat("Z9", null);
  assert.equal(s.redo(), true);
  assert.equal(s.getFormat("B2"), "0%");
});

test("cp41h insert and delete move formats; inserted cells have none", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.set("A3", "3");
  s.setFormat("A1", "0.0");
  s.setFormat("A3", "0.00");
  s.setFormat("C1", "0%");
  s.insertRows(2, 2);
  assert.equal(s.getFormat("A1"), "0.0");
  assert.equal(s.getFormat("A2"), null);
  assert.equal(s.getFormat("A3"), null);
  assert.equal(s.getFormat("A5"), "0.00");
  assert.equal(s.display("A5"), "3.00");
  s.insertCols("B", 1);
  assert.equal(s.getFormat("B1"), null);
  assert.equal(s.getFormat("D1"), "0%");
  s.deleteRows(5, 1);
  assert.equal(s.getFormat("A5"), null);
  assert.equal(s.getInput("A5"), null);
  s.deleteCols("A", 1);
  assert.equal(s.getFormat("A1"), null);
  assert.equal(s.getFormat("C1"), "0%");
  s.undo();
  s.undo();
  assert.equal(s.getFormat("A5"), "0.00");
  assert.equal(s.getFormat("A1"), "0.0");
  s.undo();
  s.undo();
  assert.equal(s.getFormat("A3"), "0.00");
  assert.equal(s.getFormat("C1"), "0%");
});

test("cp41h copy copies formats in the same undo step", () => {
  const s = createSheet();
  s.set("A1", "1.5");
  s.set("B1", "2.5");
  s.setFormat("A1", "0.00");
  s.setFormat("B5", "0%");
  s.set("B5", "0.25");
  s.copy("A1:B1", "A5");
  assert.equal(s.getFormat("A5"), "0.00");
  assert.equal(s.getFormat("B5"), null);
  assert.equal(s.display("A5"), "1.50");
  assert.equal(s.display("B5"), "2.5");
  assert.equal(s.undo(), true);
  assert.equal(s.getFormat("A5"), null);
  assert.equal(s.getFormat("B5"), "0%");
  assert.equal(s.display("B5"), "25%");
  s.copy("A1", "A1");
  assert.equal(s.getFormat("A1"), "0.00");
});

test("cp41h toCSV writes formatted text; formulas mode does not", () => {
  const s = createSheet();
  s.set("A1", "0.5");
  s.setFormat("A1", "0%");
  s.set("B1", "1234");
  s.setFormat("B1", "#,##0");
  s.set("C1", "=B1");
  assert.equal(s.toCSV(), '50%,"1,234",1234');
  assert.equal(s.toCSV({ formulas: true }), "0.5,1234,=B1");
});

test("cp41h formats are per sheet and survive a rename", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.set("A1", "0.125");
  d.setFormat("A1", "0.00");
  m.set("A1", "=Data!A1");
  m.setFormat("A2", "0%");
  assert.equal(d.display("A1"), "0.12");
  assert.equal(m.display("A1"), "0.125");
  assert.equal(m.getFormat("A1"), null);
  b.renameSheet("Data", "Facts");
  assert.equal(d.getFormat("A1"), "0.00");
  assert.equal(m.getFormat("A2"), "0%");
  assert.equal(m.getInput("A1"), "=Facts!A1");
  assert.equal(d.display("A1"), "0.12");
});

test("cp41h CHANGES.md has a cp41 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 41);
  assert.match(lines[40], /^- cp41: \S/);
  assert.notEqual(lines[40].slice(8).toLowerCase(), "number formats");
});
