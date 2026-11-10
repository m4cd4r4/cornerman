// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const err = (v) => (v && typeof v === "object" ? `${v.code}@${v.cell}` : v);
function val(f, setup = {}, opts) {
  const s = createSheet(opts);
  for (const [k, v] of Object.entries(setup)) s.set(k, v);
  s.set("E9", f);
  return err(s.get("E9"));
}
// Independent count: walk the days with the JavaScript calendar (serial 1 = 2000-01-01).
const EPOCH = Date.UTC(2000, 0, 1);
function oracle(a, b, holidays = []) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const off = new Set(holidays);
  let n = 0;
  for (let s = lo; s <= hi; s++) {
    const day = new Date(EPOCH + (s - 1) * 86400000).getUTCDay();
    if (day !== 0 && day !== 6 && !off.has(s)) n++;
  }
  return n;
}
const D = (y, m, d) => (Date.UTC(y, m - 1, d) - EPOCH) / 86400000 + 1;

test("cp59h counts agree with the calendar", () => {
  const pairs = [[1, 1], [1, 2], [1, 3], [1, 7], [2, 8], [3, 3], [5, 11], [D(2024, 1, 1), D(2024, 12, 31)], [D(2000, 2, 25), D(2000, 3, 6)], [D(2099, 12, 30), D(2100, 3, 1)], [17, 4000], [123456, 123460], [1, 2921940], [2921930, 2921940]];
  for (const [a, b] of pairs) assert.equal(val(`=NETWORKDAYS(${a}, ${b})`), oracle(a, b), `${a} ${b}`);
  assert.equal(val("=NETWORKDAYS(1, 2921940)"), 2087100);
  assert.equal(val("=NETWORKDAYS(1.9, 3.99)"), 1);
  assert.equal(val("=NETWORKDAYS(DATE(2024, 1, 6), DATE(2024, 1, 7))"), 0);
});

test("cp59h end before start counts the same, never negative", () => {
  assert.equal(val("=NETWORKDAYS(DATE(2024, 1, 5), DATE(2024, 1, 1))"), 5);
  assert.equal(val("=NETWORKDAYS(D1, C1)", { C1: "=DATE(2024, 1, 1)", D1: "=DATE(2024, 1, 31)" }), 23);
  assert.equal(val("=NETWORKDAYS(2921940, 1)"), 2087100);
  assert.equal(val("=NETWORKDAYS(8, 3)"), 5);
  assert.equal(val("=NETWORKDAYS(C1, C2, C3:C4)", { C1: "40", C2: "30", C3: "33", C4: "38" }), oracle(30, 40, [33, 38]));
});

test("cp59h only working-day holidays between the dates count, once each", () => {
  const jan = { C1: "=DATE(2024, 1, 1)", C2: "=DATE(2024, 1, 31)" };
  const nd = (rows) => {
    const setup = { ...jan };
    rows.forEach((r, i) => { setup[`H${i + 1}`] = r; });
    return val("=NETWORKDAYS(C1, C2, H1:H6)", setup);
  };
  assert.equal(nd([]), 23);
  assert.equal(nd(["=DATE(2024, 1, 1)"]), 22);
  assert.equal(nd(["=DATE(2024, 1, 6)", "=DATE(2024, 1, 7)"]), 23);
  assert.equal(nd(["=DATE(2023, 12, 29)", "=DATE(2024, 2, 1)"]), 23);
  assert.equal(nd(["=DATE(2024, 1, 2)", "=DATE(2024, 1, 2)", "=DATE(2024, 1, 2)"]), 22);
  assert.equal(nd([String(D(2024, 1, 3)) + ".7"]), 22);
  assert.equal(nd([String(D(2024, 1, 3)) + ".7", String(D(2024, 1, 3))]), 22);
  assert.equal(nd(["0", "-3", "1000000000", "-0.5"]), 23);
  assert.equal(nd(["=DATE(2024, 1, 31)", "=DATE(2024, 1, 1)"]), 21);
});

test("cp59h text, booleans and empty cells in the holidays are skipped", () => {
  const setup = { C1: "=DATE(2024, 1, 1)", C2: "=DATE(2024, 1, 31)", H1: `="${D(2024, 1, 2)}"`, H2: "=TRUE", H3: "holiday", H5: '=""', H6: String(D(2024, 1, 4)) };
  assert.equal(val("=NETWORKDAYS(C1, C2, H1:H6)", setup), 22);
  assert.equal(val("=NETWORKDAYS(C1, C2, H3)", setup), 23);
  assert.equal(val("=NETWORKDAYS(C1, C2, H4)", setup), 23);
  assert.equal(val("=NETWORKDAYS(1, 7, H1:H3)", { H1: "2", H2: "=1=1", H3: "x" }), 5);
});

test("cp59h holidays must be a range argument and are not evaluated otherwise", () => {
  assert.equal(val("=NETWORKDAYS(1, 9, DATE(2000, 1, 3))"), "#VALUE!@E9");
  assert.equal(val("=NETWORKDAYS(1, 9, 3)"), "#VALUE!@E9");
  assert.equal(val("=NETWORKDAYS(1, 9, 1/0)"), "#VALUE!@E9");
  assert.equal(val("=NETWORKDAYS(1, 9, H1)", { H1: "3" }), 4);
  assert.equal(val("=NETWORKDAYS(1, 9, H1:H1)", { H1: "3" }), 4);
  assert.equal(val("=NETWORKDAYS(nope, 9, 3)"), "#NAME?@E9");
  assert.equal(val("=NETWORKDAYS(1/0, 9, 3)"), "#VALUE!@E9");
  assert.equal(val("=NETWORKDAYS(1/0, 9, 3)", {}, { errorOrder: "first" }), "#DIV/0!@E9");
  assert.equal(val("=NETWORKDAYS(1, 9, A1:CZ200)"), "#REF!@E9");
  assert.equal(val("=NETWORKDAYS(1, 9, Nowhere!A1:A3)"), "#REF!@E9");
  const s = createSheet();
  s.defineConstant("HOL", 3);
  s.set("A1", "=NETWORKDAYS(1, 9, HOL)");
  assert.equal(err(s.get("A1")), "#VALUE!@A1");
  s.defineName("HOL", "B1:B2");
  s.set("B2", "4");
  assert.equal(s.get("A1"), 4);
  s.removeName("HOL");
  assert.equal(err(s.get("A1")), "#NAME?@A1");
});

test("cp59h arguments and errors", () => {
  for (const f of ["=NETWORKDAYS(1)", "=NETWORKDAYS()", "=NETWORKDAYS(1, 2, H1, H2)", "=NETWORKDAYS(0, 5)", "=NETWORKDAYS(5, 0.5)", "=NETWORKDAYS(5, 2921941)", "=NETWORKDAYS(-1, 5)", "=NETWORKDAYS(A1, 5)", '=NETWORKDAYS("1", 5)', "=NETWORKDAYS(A1:A2, 5)"]) {
    assert.equal(val(f), "#VALUE!@E9", f);
  }
  assert.equal(val("=NETWORKDAYS(0, nope)"), "#NAME?@E9");
  assert.equal(val("=NETWORKDAYS(0, 5, H1:H2)", { H2: "=1/0" }), "#DIV/0!@H2");
  assert.equal(val("=NETWORKDAYS(1, 5, H1:H2)", { H1: "=1/0", H2: "=nope" }), "#NAME?@H2");
  assert.equal(val("=NETWORKDAYS(1, 5, H1:H2)", { H1: "=1/0", H2: "=nope" }, { errorOrder: "first" }), "#DIV/0!@H1");
  assert.equal(val("=NETWORKDAYS(1, 1/0, H1:H2)", { H1: "=1/0", H2: "=nope" }, { errorOrder: "first" }), "#DIV/0!@E9");
  assert.equal(val("=NETWORKDAYS(1, 5, H1:H2)", { H1: "=1/0", H2: "=1/0" }), "#DIV/0!@H1");
  assert.equal(val("=NETWORKDAYS(TRUE, 7)"), 5);
});

test("cp59h holidays are precedents and recalculate; hidden rows and merges", () => {
  const s = createSheet();
  s.set("A1", "=NETWORKDAYS(1, 14, B1:B3)");
  assert.deepEqual(s.precedents("A1"), ["B1", "B2", "B3"]);
  assert.equal(s.get("A1"), 10);
  s.set("B2", "3");
  assert.equal(s.get("A1"), 9);
  s.hideRows(2);
  assert.equal(s.get("A1"), 9);
  s.set("C1", "=SUBTOTAL(2, B1:B3)");
  assert.equal(s.get("C1"), 0);
  s.set("B1", "4");
  s.merge("B1:B2");
  assert.equal(s.get("B2"), null);
  assert.equal(s.get("A1"), 9);
  s.unmerge("B1");
  assert.equal(s.get("A1"), 8);
  assert.deepEqual(s.dependents("B3"), ["A1", "C1"]);
});

test("cp59h insert, delete and copy move the holidays range", () => {
  const s = createSheet();
  s.set("B1", "3");
  s.set("B2", "4");
  s.set("A1", "=NETWORKDAYS(1, 14, B1:B2)");
  s.insertRows(2);
  assert.equal(s.getInput("A1"), "=NETWORKDAYS(1, 14, B1:B3)");
  assert.equal(s.get("A1"), 8);
  s.copy("A1", "A2");
  assert.equal(s.getInput("A2"), "=NETWORKDAYS(1, 14, B2:B4)");
  assert.equal(s.get("A2"), 9);
  s.deleteCols("B");
  assert.equal(s.getInput("A1"), "=NETWORKDAYS(1, 14, #REF!)");
  assert.equal(err(s.get("A1")), "#REF!@A1");
  s.undo();
  s.deleteRows(2);
  assert.equal(s.getInput("A1"), "=NETWORKDAYS(1, 14, B1:B2)");
  assert.equal(s.get("A1"), 8);
});

test("cp59h holidays on another sheet and in a workbook name", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const h = b.addSheet("Hols");
  h.fromCSV("3\n4\nx", "A1");
  b.defineName("OFF", "Hols!A1:A3");
  m.set("A1", "=NETWORKDAYS(1, 14, Hols!A1:A3)");
  m.set("A2", "=NETWORKDAYS(14, 1, OFF)");
  assert.equal(m.get("A1"), 8);
  assert.equal(m.get("A2"), 8);
  assert.deepEqual(m.precedents("A2"), ["Hols!A1", "Hols!A2", "Hols!A3"]);
  h.insertRows(1);
  assert.equal(m.get("A1"), 8);
  assert.equal(m.get("A2"), 8);
  h.set("A3", "1");
  assert.equal(m.get("A1"), 9);
  assert.equal(m.get("A2"), 9);
  b.removeSheet("Hols");
  assert.equal(err(m.get("A1")), "#REF!@A1");
  assert.equal(err(m.get("A2")), "#REF!@A2");
});

test("cp59h CHANGES.md has a cp59 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 59);
  assert.match(lines[58], /^- cp59: \S/);
  assert.notEqual(lines[58].slice(8).toLowerCase(), "networkdays");
});
