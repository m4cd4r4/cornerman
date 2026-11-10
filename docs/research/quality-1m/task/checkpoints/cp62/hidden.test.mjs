// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook, loadWorkbook } from "../../src/index.mjs";

const err = (v) => (v && typeof v === "object" ? `${v.code}@${v.cell}` : v);
function val(f, setup = {}, opts) {
  const s = createSheet(opts);
  for (const [k, v] of Object.entries(setup)) s.set(k, v);
  s.set("H8", f);
  return err(s.get("H8"));
}

test("cp62h names in order, any case, nested", () => {
  assert.equal(val("=LET(x, 2, y, x + 1, x * y)"), 6);
  assert.equal(val("=LET(x, 1, X + 1)"), 2);
  assert.equal(val("=LET(Total_1, 3, total_1 ^ 2)"), 9);
  assert.equal(val("=LET(x1y, 1, x1y + 1)"), 2);
  assert.equal(val("=LET(x, 1, LET(x, 2, x) + x)"), 3);
  assert.equal(val("=LET(x, 1, LET(x, x + 1, x) + x)"), 3);
  assert.equal(val("=LET(a, 1, LET(b, a + 1, a + b))"), 3);
  assert.equal(val("=LET(a, 1, b, LET(a, 10, a * 2), a + b)"), 21);
  assert.equal(val("=LET(n, 3, IF(n > 2, n * 10, 0))"), 30);
  assert.equal(val("=LET(n, 2, CHOOSE(n, n, n * 5))"), 10);
  assert.equal(val("=LET(x, 2, x) + LET(x, 3, x)"), 5);
});

test("cp62h the shape of the arguments is checked first", () => {
  for (const f of ["=LET(x, 1)", "=LET(x)", "=LET()", "=LET(x, 1, y, 2)", '=LET("x", 1, 2)', "=LET(A1, 1, A1)", "=LET(ab12, 1, 2)", "=LET($A$1, 1, 2)", "=LET(TRUE, 1, 2)", "=LET(x + 1, 1, 2)", "=LET(SUM(1), 1, 2)", "=LET(x, 1, X, 2, x)", "=LET(x, 1, y, 2, x, 3, x)", "=LET(x, 1/0, x, 2, nope)", "=LET(Data!A1, 1, 2)"]) {
    assert.equal(val(f), "#VALUE!@H8", f);
  }
  assert.equal(val("=LET(abc12, 1, 2)"), "#PARSE!@H8");
  assert.equal(val("=LET(x, 1, LET(x, 2, x))"), 2);
});

test("cp62h inside its own value a name means what it means outside", () => {
  const s = createSheet();
  s.defineConstant("X", 5);
  s.set("A1", "=LET(x, x + 1, x)");
  s.set("A2", "=LET(x, x + 1, y, x * 2, y)");
  s.set("A3", "=LET(y, x, x, y + 1, x + y)");
  assert.equal(s.get("A1"), 6);
  assert.equal(s.get("A2"), 12);
  assert.equal(s.get("A3"), 11);
  s.removeName("X");
  assert.equal(err(s.get("A1")), "#NAME?@A1");
  assert.equal(err(s.get("A3")), "#NAME?@A3");
});

test("cp62h every value is evaluated, but its error only matters where the name is used", () => {
  assert.equal(val("=LET(x, 1/0, 5)"), 5);
  assert.equal(val("=LET(x, nope, y, 2, y)"), 2);
  assert.equal(val("=LET(x, 1/0, x + 1)"), "#DIV/0!@H8");
  assert.equal(val("=LET(x, B1, x)", { B1: "=1/0" }), "#DIV/0!@B1");
  assert.equal(val("=LET(x, B1, IFERROR(x, 7))", { B1: "=1/0" }), 7);
  assert.equal(val("=LET(x, nope, y, 1/0, x + y)"), "#NAME?@H8");
  assert.equal(val("=LET(x, nope, y, 1/0, y + x)", {}, { errorOrder: "first" }), "#DIV/0!@H8");
  assert.equal(val("=LET(x, A1:A2, 1)"), 1);
  assert.equal(val("=LET(x, A1:A2, x)"), "#VALUE!@H8");
  const s = createSheet();
  s.set("B1", "=1+1");
  s.set("A1", "=LET(x, B1, 5)");
  const before = s.stats().evaluations;
  assert.equal(s.get("A1"), 5);
  assert.equal(s.stats().evaluations, before + 2);
});

test("cp62h a name holds a value, never a range", () => {
  const setup = { A1: "5", A2: "6", A3: "7" };
  for (const f of ["=LET(r, A1:A3, SUM(r))", "=LET(x, 5, SUM(x))", "=LET(x, A1, SUM(x))", "=LET(x, A1, COUNT(x))", "=LET(x, A1, COUNTIF(x, 5))", "=LET(x, A1, SUMPRODUCT(x))", "=LET(x, A1, AND(x))", "=LET(x, A1, NETWORKDAYS(1, 9, x))", "=LET(x, A1, VLOOKUP(5, x, 1))"]) {
    assert.equal(val(f, setup), "#VALUE!@H8", f);
  }
  assert.equal(val("=LET(x, A1, x * 2)", setup), 10);
  assert.equal(val("=LET(x, A1, SUM(x + 0, A2:A3))", setup), 18);
  assert.equal(val("=LET(x, A1, ROUND(x / 3, 2))", setup), 1.67);
  assert.equal(val("=LET(v, C1, v + 1)", setup), 1);
  assert.equal(val('=LET(v, C1, v & "a")', setup), "a");
  assert.equal(val("=LET(v, C1, v)", setup), 0);
  assert.equal(val("=LET(v, C1, ISERROR(v))", setup), false);
});

test("cp62h LET names hide sheet names, workbook names and constants inside the LET only", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  b.addSheet("Data").set("A1", "100");
  m.set("C1", "10");
  m.defineName("TAX", "C1");
  b.defineConstant("RATE", 0.5);
  m.set("A1", "=LET(tax, 2, tax * 3) + TAX");
  m.set("A2", "=LET(rate, 4, rate) + RATE");
  m.set("A3", "=LET(tax, 1, SUM(TAX))");
  m.set("A4", "=SUM(TAX) + LET(tax, 1, tax)");
  m.set("A5", "=LET(data, 2, Data!A1 * data)");
  m.set("A6", "=LET(rate, rate * 10, rate)");
  assert.equal(m.get("A1"), 16);
  assert.equal(m.get("A2"), 4.5);
  assert.equal(err(m.get("A3")), "#VALUE!@A3");
  assert.equal(m.get("A4"), 11);
  assert.equal(m.get("A5"), 200);
  assert.equal(m.get("A6"), 5);
  assert.deepEqual(m.names(), { TAX: "C1" });
  assert.deepEqual(b.names(), { RATE: "=0.5" });
});

test("cp62h a hidden defined name is not a precedent and does not recalculate the formula", () => {
  const s = createSheet();
  s.set("C1", "1");
  s.set("C2", "2");
  s.defineName("X", "C1");
  s.set("A1", "=LET(x, 7, x)");
  s.set("A2", "=LET(x, X + 1, x * 2)");
  s.set("A3", "=LET(y, 1, y) + X");
  s.set("A4", "=LET(x, D1, y, D2, x + y)");
  assert.deepEqual(s.precedents("A1"), []);
  assert.deepEqual(s.precedents("A2"), ["C1"]);
  assert.deepEqual(s.precedents("A3"), ["C1"]);
  assert.deepEqual(s.precedents("A4"), ["D1", "D2"]);
  assert.deepEqual(s.dependents("C1"), ["A2", "A3"]);
  assert.equal(s.get("A1"), 7);
  assert.equal(s.get("A2"), 4);
  assert.equal(s.get("A3"), 2);
  assert.equal(s.get("A4"), 0);
  s.set("A6", "=LET(x, 7, y, x + 1, y)");
  assert.equal(s.get("A6"), 8);
  assert.deepEqual(s.precedents("A6"), []);
  const before = s.stats().evaluations;
  s.defineName("X", "C2");
  assert.equal(s.get("A1"), 7);
  assert.equal(s.get("A6"), 8);
  assert.equal(s.get("A2"), 6);
  assert.equal(s.get("A3"), 3);
  assert.equal(s.stats().evaluations, before + 2);
  s.removeName("X");
  assert.equal(s.get("A1"), 7);
  assert.equal(err(s.get("A2")), "#NAME?@A2");
  assert.equal(err(s.get("A3")), "#NAME?@A3");
  assert.equal(s.stats().evaluations, before + 4);
  s.set("A5", "=LET(x, 1, A5 + x)");
  assert.equal(err(s.get("A5")), "#CYCLE!@A5");
});

test("cp62h insert, delete, copy, rename and canonical text", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.set("A1", "3");
  m.set("A1", "5");
  m.set("B1", "=LET(ab, A1, cd, Data!A1, ab * cd)");
  assert.equal(m.get("B1"), 15);
  m.insertRows(1);
  m.insertCols("A");
  assert.equal(m.getInput("C2"), "=LET(ab, B2, cd, Data!A1, ab * cd)");
  assert.equal(m.get("C2"), 15);
  m.copy("C2", "D3");
  assert.equal(m.getInput("D3"), "=LET(ab, C3, cd, Data!B2, ab * cd)");
  assert.equal(m.get("D3"), 0);
  assert.equal(m.canonical("C2"), "=LET(AB,B2,CD,DATA!A1,AB*CD)");
  b.renameSheet("Data", "Facts");
  assert.equal(m.getInput("C2"), "=LET(ab, B2, cd, Facts!A1, ab * cd)");
  m.deleteCols("B");
  assert.equal(m.getInput("B2"), "=LET(ab, #REF!, cd, Facts!A1, ab * cd)");
  assert.equal(err(m.get("B2")), "#REF!@B2");
  b.deleteSheet("Facts");
  assert.equal(m.getInput("B2"), "=LET(ab, #REF!, cd, #REF!, ab * cd)");
  const c = loadWorkbook(b.save());
  assert.equal(err(c.sheet("Main").get("B2")), "#REF!@B2");
});

test("cp62h saved and loaded as typed, with the names working", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  m.set("A1", "4");
  m.defineConstant("K", 100);
  m.set("A2", "=LET(k, A1, k * K)");
  m.set("A3", "=LET(n, A1, n) * K");
  const c = loadWorkbook(b.save());
  assert.equal(c.sheet("Main").getInput("A2"), "=LET(k, A1, k * K)");
  assert.equal(c.sheet("Main").get("A2"), 16);
  assert.equal(c.sheet("Main").get("A3"), 400);
  assert.equal(c.save(), b.save());
});

test("cp62h CHANGES.md has a cp62 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 62);
  assert.match(lines[61], /^- cp62: \S/);
  assert.notEqual(lines[61].slice(8).toLowerCase(), "let");
});
