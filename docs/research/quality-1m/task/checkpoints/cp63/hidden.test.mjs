// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, loadSheet, createWorkbook, loadWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
const C = { decimal: "," };
function shown(input, format) {
  const s = createSheet(C);
  s.set("B2", input);
  if (format) s.setFormat("B2", format);
  return s.display("B2");
}

test("cp63h plain numbers swap the point for a comma", () => {
  assert.equal(shown("0.5"), "0,5");
  assert.equal(shown("-2.25"), "-2,25");
  assert.equal(shown("=1/3"), "0,333333");
  assert.equal(shown("=2/3"), "0,666667");
  assert.equal(shown("1234567"), "1234567");
  assert.equal(shown("=0.1+0.2"), "0,3");
  assert.equal(shown("=-0.0000001"), "0");
  assert.equal(shown("=10^15"), "##########");
  assert.equal(shown("=-10^15"), "##########");
  assert.equal(shown("=-1/8"), "-0,125");
  assert.equal(shown("999999999999999"), "999999999999999");
});

test("cp63h formats put the comma in the places and a point between groups", () => {
  assert.equal(shown("1234567.891", "#,##0.00"), "1.234.567,89");
  assert.equal(shown("1234.5", "#,##0"), "1.234");
  assert.equal(shown("1234.5", "0.000"), "1234,500");
  assert.equal(shown("0.125", "0.0%"), "12,5%");
  assert.equal(shown("0.575", "0%"), "58%");
  assert.equal(shown("1234.5", "#,##0%"), "123.450%");
  assert.equal(shown("-1234.567", "#,##0.0"), "-1.234,6");
  assert.equal(shown("-0.004", "0.00"), "0,00");
  assert.equal(shown("1.005", "0.00"), "1,00");
  assert.equal(shown("999", "#,##0.0"), "999,0");
  const s = createSheet(C);
  assert.throws(() => s.setFormat("A1", "0,00"), thrown("#FORMAT", "0,00"));
  assert.throws(() => s.setFormat("A1", "#.##0"), thrown("#FORMAT", "#.##0"));
});

test("cp63h only numbers change; text is shown as it is", () => {
  const s = createSheet(C);
  s.set("A1", "0.5");
  s.set("A2", '=A1&""');
  s.set("A3", "1,5");
  s.set("A4", "=TRUE");
  s.set("A5", "=1/0");
  s.set("A6", "a.b,c");
  s.set("A7", '=TEXT(1234.5, "#,##0.0")');
  s.set("A8", "=LEN(0.25)");
  s.set("A9", '=FIND(".", A1&"")');
  assert.equal(s.display("A1"), "0,5");
  assert.equal(s.display("A2"), "0.5");
  assert.equal(s.get("A2"), "0.5");
  assert.equal(s.display("A3"), "1,5");
  assert.equal(s.get("A3"), "1,5");
  assert.equal(s.display("A4"), "TRUE");
  assert.equal(s.display("A5"), "#DIV/0!");
  assert.equal(s.display("A6"), "a.b,c");
  assert.equal(s.display("A7"), "1,234.5");
  assert.equal(s.display("A8"), "4");
  assert.equal(s.get("A9"), 2);
  assert.equal(s.text("A1"), "0,5");
  assert.equal(s.display("Z9"), "");
});

test("cp63h inputs and formulas are read as before", () => {
  const s = createSheet(C);
  s.set("A1", "1.5");
  s.set("A2", "1,5");
  s.set("A3", "=A1*2");
  s.set("A4", "=A2*2");
  s.set("A5", "=ROUND(2.345, 2)");
  s.set("A6", "=1,5");
  assert.equal(s.get("A1"), 1.5);
  assert.equal(s.get("A3"), 3);
  assert.equal(s.get("A4").code, "#VALUE!");
  assert.equal(s.display("A5"), "2,34");
  assert.equal(s.get("A6").code, "#PARSE!");
  s.fromCSV('"2,5",2.5\n7', "C1");
  assert.equal(s.get("C1"), "2,5");
  assert.equal(s.get("D1"), 2.5);
  assert.equal(s.display("D1"), "2,5");
  assert.equal(s.getInput("D1"), "2.5");
  assert.equal(s.canonical("A5"), "=ROUND(2.345,2)");
  assert.equal(s.find("2.5").join(), "D1");
  assert.equal(s.find("2,5").join(), "C1");
});

test("cp63h toCSV keeps the comma separator and quotes the numbers", () => {
  const s = createSheet(C);
  s.set("A1", "0.5");
  s.set("B1", "2");
  s.set("C1", "=A1*3");
  s.set("A2", "1234.5");
  s.setFormat("A2", "#,##0.00");
  s.set("B2", "x");
  assert.equal(s.toCSV(), '"0,5",2,"1,5"\n"1.234,50",x,');
  assert.equal(s.toCSV({ formulas: true }), "0.5,2,=A1*3\n1234.5,x,");
  const p = createSheet();
  p.set("A1", "0.5");
  p.set("B1", "1234.5");
  p.setFormat("B1", "#,##0.00");
  assert.equal(p.toCSV(), '0.5,"1,234.50"');
});

test("cp63h options are checked in order, before the text", () => {
  for (const make of [(o) => createSheet(o), (o) => createWorkbook(o), (o) => loadSheet("not json", o), (o) => loadWorkbook("not json", o)]) {
    assert.throws(() => make({ decimal: ";" }), thrown("#ARG", ";"));
    assert.throws(() => make({ decimal: "" }), thrown("#ARG", ""));
    assert.throws(() => make({ decimal: null }), thrown("#ARG", "null"));
    assert.throws(() => make({ decimal: 1 }), thrown("#ARG", "1"));
    assert.throws(() => make({ decimal: " ," }), thrown("#ARG", " ,"));
    assert.throws(() => make({ errorOrder: "bad", decimal: ";" }), thrown("#ARG", "bad"));
    assert.throws(() => make(null), thrown("#ARG", ""));
    assert.throws(() => make([]), thrown("#ARG", ""));
  }
  assert.throws(() => loadSheet("not json", C), thrown("#LOAD", ""));
  assert.throws(() => loadWorkbook("not json", C), thrown("#LOAD", ""));
  assert.equal(createSheet({ decimal: "." }).display("A1"), "");
  assert.equal(createSheet({ decimal: undefined, errorOrder: "first" }).display("A1"), "");
});

test("cp63h the option is not saved; load uses the one it is given", () => {
  const a = createSheet(C);
  const b = createSheet();
  for (const s of [a, b]) {
    s.set("A1", "0.5");
    s.defineConstant("K", 1.5);
    s.setNote("A1", "half");
  }
  assert.equal(a.save(), b.save());
  assert.equal(loadSheet(a.save()).display("A1"), "0.5");
  assert.equal(loadSheet(b.save(), C).display("A1"), "0,5");
  const book = createWorkbook({ decimal: ",", errorOrder: "first" });
  const m = book.addSheet("Main");
  m.set("A1", "2.5");
  m.setFormat("A1", "0.00");
  const plain = createWorkbook({ errorOrder: "first" });
  plain.addSheet("Main").set("A1", "2.5");
  plain.sheet("Main").setFormat("A1", "0.00");
  assert.equal(book.save(), plain.save());
  assert.equal(loadWorkbook(book.save()).sheet("Main").display("A1"), "2.50");
  const c = loadWorkbook(book.save(), { decimal: ",", errorOrder: "priority" });
  assert.equal(c.sheet("Main").display("A1"), "2,50");
  assert.equal(JSON.parse(c.save()).errorOrder, "first");
  const v1 = loadWorkbook(a.save(), C);
  assert.equal(v1.sheet("Sheet_1").display("A1"), "0,5");
});

test("cp63h every sheet of a workbook shares it, even after removal", () => {
  const b = createWorkbook(C);
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  const x = b.addSheet("Extra");
  d.set("A1", "0.75");
  m.set("A1", "=Data!A1");
  x.set("A1", "1.5");
  assert.equal(m.display("A1"), "0,75");
  assert.equal(d.display("A1"), "0,75");
  b.removeSheet("Data");
  assert.equal(d.display("A1"), "0,75");
  assert.equal(m.display("A1"), "#REF!");
  b.deleteSheet("Extra");
  assert.equal(x.display("A1"), "1,5");
  const y = b.addSheet("Later");
  y.set("A1", "=1/4");
  assert.equal(y.display("A1"), "0,25");
});

test("cp63h values, undo, names and explain are the same in both settings", () => {
  const make = (opts) => {
    const s = createSheet(opts);
    s.set("A1", "1.25");
    s.set("A2", "=A1*2");
    s.defineConstant("RATE", 0.5);
    s.set("A3", "=A2*RATE");
    s.sort("A1:A3", "A", { descending: true });
    s.undo();
    return s;
  };
  const a = make(C);
  const b = make();
  for (const k of ["A1", "A2", "A3"]) assert.equal(a.get(k), b.get(k));
  assert.deepEqual(a.names(), { RATE: "=0.5" });
  assert.deepEqual(a.explain("A3"), b.explain("A3"));
  assert.equal(a.display("A3"), "1,25");
  assert.equal(b.display("A3"), "1.25");
});

test("cp63h CHANGES.md has a cp63 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 63);
  assert.match(lines[62], /^- cp63: \S/);
  assert.notEqual(lines[62].slice(8).toLowerCase(), "decimal comma");
});

test("cp63h recall: the text of a number rounds half to even on its digits, as checkpoint 5 shows numbers", () => {
  const s = createSheet(C);
  s.setMany({ A1: "=0.0000005", A2: "=0.0000015", A3: "=0.0000025", A4: "=0.0000005000001" });
  assert.deepEqual(["A1", "A2", "A3", "A4"].map((k) => s.display(k)), ["0", "0,000002", "0,000002", "0,000001"]);
});
