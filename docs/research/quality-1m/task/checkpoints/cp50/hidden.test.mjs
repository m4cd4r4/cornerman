// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const err = (v) => (v && typeof v === "object" ? `${v.code}@${v.cell}` : v);
const at = (s, f, cell = "Z9") => { s.set(cell, f); return err(s.get(cell)); };
function col() {
  const s = createSheet();
  s.fromCSV("4\n1\nx\nTRUE\n\n6", "A1");
  return s;
}

test("cp50h the five codes over numbers, text, booleans and empty cells", () => {
  const s = col();
  assert.equal(at(s, "=SUBTOTAL(9, A1:A6)"), 11);
  assert.equal(at(s, "=SUBTOTAL(1, A1:A6)"), 11 / 3);
  assert.equal(at(s, "=SUBTOTAL(2, A1:A6)"), 3);
  assert.equal(at(s, "=SUBTOTAL(4, A1:A6)"), 6);
  assert.equal(at(s, "=SUBTOTAL(5, A1:A6)"), 1);
  assert.equal(at(s, "=SUBTOTAL(9.99, A1:A6)"), 11);
  assert.equal(at(s, "=SUBTOTAL(1.9, A1:A6)"), 11 / 3);
  assert.equal(at(s, "=SUBTOTAL(TRUE, A1:A6)"), 11 / 3);
  assert.equal(at(s, "=SUBTOTAL(9, A1:A6, A1, A1:A2)"), 20);
});

test("cp50h only codes 1, 2, 4, 5 and 9 exist", () => {
  const s = col();
  for (const code of ["3", "0", "6", "10", "11", "101", "102", "109", "111", "-9", "-1.5", "B9", "1000"]) {
    assert.equal(at(s, `=SUBTOTAL(${code}, A1:A6)`), "#VALUE!@Z9", code);
  }
  assert.equal(at(s, '=SUBTOTAL("9", A1:A6)'), "#VALUE!@Z9");
  s.set("Y1", "=1/0");
  assert.equal(at(s, "=SUBTOTAL(Y1, A1:A6)"), "#DIV/0!@Y1");
  assert.equal(at(s, "=SUBTOTAL(nope, A1:A6)"), "#NAME?@Z9");
});

test("cp50h range arguments only, checked in the stated order", () => {
  const s = col();
  s.set("Y1", "=1/0");
  s.defineName("NUMS", "A1:A2");
  s.defineName("ONE", "A6");
  assert.equal(at(s, "=SUBTOTAL(9)"), "#VALUE!@Z9");
  assert.equal(at(s, "=SUBTOTAL(Y1)"), "#VALUE!@Z9");
  assert.equal(at(s, "=SUBTOTAL(9, 5)"), "#VALUE!@Z9");
  assert.equal(at(s, "=SUBTOTAL(9, A1+1)"), "#VALUE!@Z9");
  assert.equal(at(s, "=SUBTOTAL(9, A1:A2, 3)"), "#VALUE!@Z9");
  assert.equal(at(s, "=SUBTOTAL(9, Nope!A1:A2, 3)"), "#VALUE!@Z9");
  assert.equal(at(s, "=SUBTOTAL(Y1, 5)"), "#DIV/0!@Y1");
  assert.equal(at(s, "=SUBTOTAL(3, 5)"), "#VALUE!@Z9");
  assert.equal(at(s, "=SUBTOTAL(9, Nope!A1:A2)"), "#REF!@Z9");
  assert.equal(at(s, "=SUBTOTAL(2, Nope!A1:A2, A1:A6)"), "#REF!@Z9");
  assert.equal(at(s, "=SUBTOTAL(9, NUMS, ONE)"), 11);
  assert.equal(at(s, "=SUBTOTAL(9, MISSING)"), "#NAME?@Z9");
});

test("cp50h hidden rows are left out for every code; hidden columns are not", () => {
  const s = col();
  s.set("B1", "100");
  s.hideRows(1);
  s.hideCols("A");
  assert.equal(at(s, "=SUBTOTAL(9, A1:B6)"), 7);
  assert.equal(at(s, "=SUBTOTAL(1, A1:A6)"), 3.5);
  assert.equal(at(s, "=SUBTOTAL(2, A1:B6)"), 2);
  assert.equal(at(s, "=SUBTOTAL(4, A1:B6)"), 6);
  assert.equal(at(s, "=SUBTOTAL(5, A1:B6)"), 1);
  assert.equal(at(s, "=SUM(A1:B6)"), 111);
  s.hideRows(2, 9);
  assert.equal(at(s, "=SUBTOTAL(9, A1:B6)"), 0);
  assert.equal(at(s, "=SUBTOTAL(2, A1:B6)"), 0);
  assert.equal(at(s, "=SUBTOTAL(1, A1:B6)"), "#DIV/0!@Z9");
  assert.equal(at(s, "=SUBTOTAL(4, A1:B6)"), "#VALUE!@Z9");
  assert.equal(at(s, "=SUBTOTAL(5, A1:B6)"), "#VALUE!@Z9");
});

test("cp50h only a formula that is a SUBTOTAL call is left out", () => {
  const s = createSheet();
  s.fromCSV("1\n2", "A1");
  s.set("A3", "=SUBTOTAL(9, A1:A2)");
  s.set("A4", "=(subtotal(9, A1:A2))");
  s.set("A5", "=SUBTOTAL(9, A1:A2)*2");
  s.set("A6", "=-SUBTOTAL(9, A1:A2)");
  s.set("A7", "=IF(TRUE, SUBTOTAL(9, A1:A2))");
  s.set("A8", "=SUM(A1:A2)");
  s.set("A9", "=SUBTOTAL(9, A1:A2");
  s.set("B1", "=SUBTOTAL(9, A1:A8)");
  assert.equal(s.get("B1"), 3 + 6 - 3 + 3 + 3);
  s.set("B2", "=SUBTOTAL(2, A1:A8)");
  assert.equal(s.get("B2"), 6);
  s.set("B3", "=SUBTOTAL(9, A1:A9)");
  assert.equal(err(s.get("B3")), "#PARSE!@A9");
  s.set("A5", "=SUBTOTAL(1, A1:A2)");
  assert.equal(s.get("B1"), 3 + 0 - 3 + 3 + 3);
});

test("cp50h errors: left-out cells are never read; counted ones follow the priority", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.set("A2", "=1/0");
  s.set("A3", "=SUBTOTAL(9, A2)");
  s.set("A4", "=nope");
  s.set("A5", "=Gone!A1");
  s.set("B1", "=SUBTOTAL(9, A1:A5)");
  assert.equal(err(s.get("A3")), "#DIV/0!@A2");
  assert.equal(err(s.get("B1")), "#REF!@A5");
  s.set("B2", "=SUBTOTAL(2, A1:A5)");
  assert.equal(s.get("B2"), 1);
  s.hideRows(5);
  assert.equal(err(s.get("B1")), "#NAME?@A4");
  s.hideRows(4);
  assert.equal(err(s.get("B1")), "#DIV/0!@A2");
  s.hideRows(2);
  assert.equal(s.get("B1"), 1);
  const f = createSheet({ errorOrder: "first" });
  f.set("A1", "=1/0");
  f.set("A2", "=nope");
  f.set("B1", "=SUBTOTAL(9, A1:A2)");
  assert.equal(err(f.get("B1")), "#DIV/0!@A1");
  f.set("B2", "=SUBTOTAL(9, Gone!A1, A1:A2)");
  assert.equal(err(f.get("B2")), "#REF!@B2");
});

test("cp50h hiding, showing, undo and redo recalculate", () => {
  const s = col();
  s.set("B1", "=SUBTOTAL(9, A1:A6)");
  s.set("B2", "=B1*10");
  assert.equal(s.get("B2"), 110);
  s.hideRows(6);
  assert.equal(s.get("B2"), 50);
  s.hideCols("A");
  assert.equal(s.get("B2"), 50);
  s.undo();
  s.undo();
  assert.equal(s.get("B2"), 110);
  s.redo();
  assert.equal(s.get("B1"), 5);
  s.showRows(1, 9999);
  assert.equal(s.get("B1"), 11);
  assert.deepEqual(s.precedents("B1"), ["A1", "A2", "A3", "A4", "A5", "A6"]);
});

test("cp50h another sheet's hidden rows decide, and it recalculates", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.fromCSV("10\n20\n30", "A1");
  d.set("A4", "=SUBTOTAL(9, A1:A3)");
  m.set("A1", "=SUBTOTAL(9, Data!A1:A4)");
  m.set("A2", "=SUBTOTAL(9, data!A1:A3, A1)");
  assert.equal(m.get("A1"), 60);
  m.hideRows(1, 3);
  assert.equal(m.get("A1"), 60);
  d.hideRows(3);
  assert.equal(m.get("A1"), 30);
  assert.equal(m.get("A2"), 30);
  d.undo();
  assert.equal(m.get("A1"), 60);
  d.redo();
  assert.equal(m.get("A1"), 30);
  m.showRows(1);
  assert.equal(m.get("A2"), 30);
  d.set("A4", "5");
  assert.equal(m.get("A1"), 35);
  b.removeSheet("Data");
  assert.equal(err(m.get("A1")), "#REF!@A1");
});

test("cp50h a SUBTOTAL over its own cell is a cycle", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.set("A2", "=SUBTOTAL(9, A1:A2)");
  assert.equal(err(s.get("A2")), "#CYCLE!@A2");
  s.set("A2", "=SUBTOTAL(9, A1)");
  assert.equal(s.get("A2"), 1);
});

test("cp50h insert, delete, copy, merges and canonical", () => {
  const s = createSheet();
  s.fromCSV("1\n2\n3", "A1");
  s.set("A4", "=subtotal(9, A1:A3)");
  s.hideRows(2);
  assert.equal(s.get("A4"), 4);
  s.insertRows(2);
  assert.equal(s.getInput("A5"), "=subtotal(9, A1:A4)");
  assert.deepEqual(s.hiddenRows(), [3]);
  assert.equal(s.get("A5"), 4);
  s.set("A2", "10");
  assert.equal(s.get("A5"), 14);
  s.copy("A5", "B5");
  assert.equal(s.getInput("B5"), "=subtotal(9, B1:B4)");
  s.copy("A5", "A6");
  assert.equal(s.getInput("A6"), "=subtotal(9, A2:A5)");
  assert.equal(s.get("A6"), 13);
  assert.equal(s.canonical("A5"), "=SUBTOTAL(9,A1:A4)");
  s.merge("A1:A2");
  assert.equal(s.get("A5"), 4);
  s.deleteRows(3);
  assert.deepEqual(s.hiddenRows(), []);
  assert.equal(s.getInput("A4"), "=subtotal(9, A1:A3)");
  s.unmerge("A1");
  assert.equal(s.get("A4"), 14);
});

test("cp50h CHANGES.md has a cp50 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 50);
  assert.match(lines[49], /^- cp50: \S/);
  assert.notEqual(lines[49].slice(8).toLowerCase(), "subtotal");
});
