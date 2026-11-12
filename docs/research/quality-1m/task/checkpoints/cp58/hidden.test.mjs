// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const err = (v) => (v && typeof v === "object" ? `${v.code}@${v.cell}` : v);
function val(f, setup = {}, opts) {
  const s = createSheet(opts);
  for (const [k, v] of Object.entries(setup)) s.set(k, v);
  s.set("C5", f);
  return err(s.get("C5"));
}
const is = (f, date) => val(`=${f} - ${date}`);

test("cp58c chat: WEEKDAY without a type counts Monday as 1 and Sunday as 7", () => {
  assert.equal(val("=WEEKDAY(1)"), 6);
  assert.equal(val("=WEEKDAY(2)"), 7);
  assert.equal(val("=WEEKDAY(3)"), 1);
  assert.equal(val("=WEEKDAY(DATE(2024, 1, 1))"), 1);
  assert.equal(val("=WEEKDAY(DATE(2024, 1, 6))"), 6);
  assert.equal(val("=WEEKDAY(DATE(2024, 1, 7))"), 7);
  assert.equal(val("=WEEKDAY(2921940)"), 5);
  assert.equal(val("=WEEKDAY(DATE(2100, 3, 1))"), 1);
});

test("cp58h WEEKDAY types 1 and 3", () => {
  assert.equal(val("=WEEKDAY(1, 1)"), 7);
  assert.equal(val("=WEEKDAY(2, 1)"), 1);
  assert.equal(val("=WEEKDAY(DATE(2024, 1, 1), 1)"), 2);
  assert.equal(val("=WEEKDAY(1, 3)"), 5);
  assert.equal(val("=WEEKDAY(2, 3)"), 6);
  assert.equal(val("=WEEKDAY(DATE(2024, 1, 1), 3)"), 0);
  assert.equal(val("=WEEKDAY(3, TRUE)"), 2);
  assert.equal(val("=WEEKDAY(3, 4/2)"), 1);
});

test("cp58h WEEKDAY checks its serial and type", () => {
  assert.equal(val("=WEEKDAY(1.9, 2)"), 6);
  assert.equal(val("=WEEKDAY(2.99, 1)"), 1);
  for (const f of ["=WEEKDAY(0)", "=WEEKDAY(-1)", "=WEEKDAY(0.5)", "=WEEKDAY(2921941)", "=WEEKDAY(A1)", '=WEEKDAY("3")', "=WEEKDAY(3, 0)", "=WEEKDAY(3, 4)", "=WEEKDAY(3, 11)", "=WEEKDAY(3, 1.5)", "=WEEKDAY(3, 2.0001)", "=WEEKDAY(3, A1)", '=WEEKDAY(3, "2")', "=WEEKDAY()", "=WEEKDAY(1, 2, 3)", "=WEEKDAY(B1:B2)"]) {
    assert.equal(val(f), "#VALUE!@C5", f);
  }
});

test("cp58h EDATE keeps the day, or takes the last day of a shorter month", () => {
  assert.equal(is("EDATE(DATE(2000, 1, 31), 1)", "DATE(2000, 2, 29)"), 0);
  assert.equal(is("EDATE(DATE(2001, 1, 31), 1)", "DATE(2001, 2, 28)"), 0);
  assert.equal(is("EDATE(DATE(2000, 3, 31), -1)", "DATE(2000, 2, 29)"), 0);
  assert.equal(is("EDATE(DATE(2000, 2, 29), 12)", "DATE(2001, 2, 28)"), 0);
  assert.equal(is("EDATE(DATE(2000, 2, 29), 48)", "DATE(2004, 2, 29)"), 0);
  assert.equal(is("EDATE(DATE(2099, 2, 28), 12)", "DATE(2100, 2, 28)"), 0);
  assert.equal(is("EDATE(DATE(2000, 5, 31), 1)", "DATE(2000, 6, 30)"), 0);
  assert.equal(is("EDATE(DATE(2001, 1, 15), -2)", "DATE(2000, 11, 15)"), 0);
  assert.equal(is("EDATE(DATE(2024, 11, 30), 3)", "DATE(2025, 2, 28)"), 0);
  assert.equal(is("EDATE(DATE(2000, 1, 15), 0)", "DATE(2000, 1, 15)"), 0);
  assert.equal(val("=EDATE(1.9, 1)"), 32);
  assert.equal(val("=EDATE(DATE(2000, 1, 30), 1) - DATE(2000, 1, 30)"), 30);
});

test("cp58h a last day does not stay a last day; EOMONTH gives last days", () => {
  assert.equal(is("EDATE(DATE(2000, 2, 29), 1)", "DATE(2000, 3, 29)"), 0);
  assert.equal(is("EDATE(DATE(2000, 4, 30), 1)", "DATE(2000, 5, 30)"), 0);
  assert.equal(is("EOMONTH(DATE(2000, 2, 10), 0)", "DATE(2000, 2, 29)"), 0);
  assert.equal(is("EOMONTH(DATE(2000, 2, 29), 1)", "DATE(2000, 3, 31)"), 0);
  assert.equal(is("EOMONTH(DATE(2000, 2, 10), 12)", "DATE(2001, 2, 28)"), 0);
  assert.equal(is("EOMONTH(DATE(2001, 3, 31), -13)", "DATE(2000, 2, 29)"), 0);
  assert.equal(val("=EOMONTH(1, 0)"), 31);
  assert.equal(val("=EOMONTH(1, 1)"), 60);
  assert.equal(val("=EOMONTH(DATE(9999, 12, 1), 0)"), 2921940);
  assert.equal(val("=DAY(EOMONTH(DATE(2100, 1, 5), 1))"), 28);
});

test("cp58h months must be a whole number", () => {
  for (const f of ["=EDATE(100, 1.5)", "=EDATE(100, -0.5)", "=EDATE(100, 0.999)", "=EOMONTH(100, 1.5)", "=EOMONTH(100, -2.25)", '=EDATE(100, "1")', "=EDATE(100, B1:B2)"]) {
    assert.equal(val(f), "#VALUE!@C5", f);
  }
  assert.equal(is("EDATE(DATE(2000, 1, 15), 2.0)", "DATE(2000, 3, 15)"), 0);
  assert.equal(is("EDATE(DATE(2000, 1, 15), 0.5*4)", "DATE(2000, 3, 15)"), 0);
  assert.equal(is("EDATE(DATE(2000, 1, 15), TRUE)", "DATE(2000, 2, 15)"), 0);
  assert.equal(val("=EDATE(100, A1)"), 100);
  assert.equal(val("=EDATE(100, A1)", { A1: "1.5" }), "#VALUE!@C5");
  assert.equal(val("=EOMONTH(100, A1)", { A1: "-1" }), 91);
});

test("cp58h results and starts outside the calendar", () => {
  for (const f of ["=EDATE(DATE(2000, 1, 15), -1)", "=EOMONTH(1, -1)", "=EDATE(DATE(9999, 12, 31), 1)", "=EOMONTH(DATE(9999, 12, 1), 1)", "=EDATE(0, 1)", "=EDATE(0.5, 1)", "=EOMONTH(2921941, -1)", "=EDATE(-5, 12)", "=EDATE(1, 10^300)", "=EDATE(A1, 1)", "=EDATE(1)", "=EOMONTH(1, 2, 3)", "=EOMONTH()"]) {
    assert.equal(val(f), "#VALUE!@C5", f);
  }
  assert.equal(is("EDATE(DATE(9999, 1, 31), 11)", "DATE(9999, 12, 31)"), 0);
  assert.equal(is("EDATE(DATE(9999, 12, 31), -95999)", "DATE(2000, 1, 31)"), 0);
});

test("cp58h errors win over every check", () => {
  assert.equal(val("=EDATE(nope, 1.5)"), "#NAME?@C5");
  assert.equal(val("=EDATE(0, 1/0)"), "#DIV/0!@C5");
  assert.equal(val("=WEEKDAY(0, 1/0)"), "#DIV/0!@C5");
  assert.equal(val("=WEEKDAY(1/0, nope)"), "#NAME?@C5");
  assert.equal(val("=WEEKDAY(1/0, nope)", {}, { errorOrder: "first" }), "#DIV/0!@C5");
  assert.equal(val("=EOMONTH(A1, B1)", { A1: "=1/0", B1: "=x" }), "#NAME?@B1");
  assert.equal(val("=EOMONTH(A1, B1)", { A1: "=1/0", B1: "=x" }, { errorOrder: "first" }), "#DIV/0!@A1");
  assert.equal(val("=IFERROR(EDATE(1, 0.5), -1)"), -1);
});

test("cp58h results are plain numbers that formats and references treat as numbers", () => {
  const s = createSheet();
  s.set("A1", "=DATE(2024, 1, 31)");
  s.set("B1", "=EDATE(A1, 1)");
  s.set("C1", "=B1 - A1");
  s.set("D1", "=WEEKDAY(B1, 2)");
  s.setFormat("B1", "#,##0");
  assert.equal(s.get("C1"), 29);
  assert.equal(s.display("B1"), "8,826");
  assert.equal(s.get("D1"), 4);
  assert.equal(err(s.get("E1")), null);
  s.set("E1", '=TEXT(B1, "yyyy-mm-dd")');
  assert.equal(err(s.get("E1")), "#VALUE!@E1");
  assert.deepEqual(s.precedents("D1"), ["B1"]);
  s.insertCols("A");
  assert.equal(s.getInput("C1"), "=EDATE(B1, 1)");
  s.copy("C1", "C2");
  assert.equal(s.getInput("C2"), "=EDATE(B2, 1)");
  assert.equal(err(s.get("C2")), "#VALUE!@C2");
  s.set("B2", "=EOMONTH(B1, 1)");
  assert.equal(s.get("C2") - s.get("B2"), 29);
  s.deleteCols("B");
  assert.equal(s.getInput("B1"), "=EDATE(#REF!, 1)");
  assert.equal(err(s.get("B1")), "#REF!@B1");
  s.undo();
  assert.equal(s.get("D1"), 29);
});

test("cp58h names, constants and other sheets", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.set("A1", "=DATE(2000, 1, 31)");
  b.defineConstant("STEP", 1);
  m.set("A1", "=EDATE(Data!A1, STEP) - DATE(2000, 2, 29)");
  assert.equal(m.get("A1"), 0);
  m.defineConstant("STEP", 0.5);
  assert.equal(err(m.get("A1")), "#VALUE!@A1");
  m.defineConstant("step", -1);
  assert.equal(err(m.get("A1")), "#VALUE!@A1");
  m.removeName("STEP");
  d.set("A1", "=DATE(2000, 3, 31)");
  assert.equal(m.get("A1"), 61);
  m.set("A2", "=COUNTIF(Data!B1:B7, 6)");
  for (let i = 1; i <= 7; i++) d.set(`B${i}`, `=WEEKDAY(${i}, 2)`);
  assert.equal(m.get("A2"), 1);
});

test("cp58h CHANGES.md has a cp58 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 58);
  assert.match(lines[57], /^- cp58: \S/);
  assert.notEqual(lines[57].slice(8).toLowerCase(), "edate, eomonth and weekday");
});
