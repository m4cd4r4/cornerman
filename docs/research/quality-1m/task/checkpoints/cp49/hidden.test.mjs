// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
function grid() {
  const s = createSheet();
  s.fromCSV("1,2,3\n4,5,6\n7,8,9", "A1");
  return s;
}

test("cp49h toCSV leaves hidden rows and columns out, in both modes", () => {
  const s = grid();
  s.set("B2", "=A2+1");
  s.hideRows(2);
  s.hideCols("B");
  assert.equal(s.toCSV(), "1,3\n7,9");
  assert.equal(s.toCSV({ formulas: true }), "1,3\n7,9");
  s.showRows(2);
  assert.equal(s.toCSV({ formulas: true }), "1,3\n4,6\n7,9");
  s.showCols("b");
  assert.equal(s.toCSV(), "1,2,3\n4,5,6\n7,8,9");
  assert.equal(s.get("B2"), 5);
});

test("cp49h the CSV rectangle counts hidden cells, then drops hidden lines", () => {
  const s = createSheet();
  s.set("A1", "a");
  s.set("D5", "z");
  s.hideRows(5);
  s.hideCols("D");
  assert.equal(s.toCSV(), "a,,\n,,\n,,\n,,");
  s.hideRows(2, 3);
  assert.equal(s.toCSV(), "a,,");
  s.hideCols("A", 3);
  assert.equal(s.toCSV(), "");
  s.showCols("B");
  assert.equal(s.toCSV(), "");
  s.showRows(1, 9999);
  assert.equal(s.toCSV(), "\n\n\n\n");
  s.hideRows(1, 9999);
  s.showCols("A", 702);
  assert.equal(s.toCSV(), "");
  assert.deepEqual(s.hiddenCols(), []);
});

test("cp49h hidden values still count everywhere else", () => {
  const s = grid();
  s.set("D1", "=SUM(A1:C3)");
  s.set("D2", "=COUNT(A2:C2)");
  s.hideRows(1, 3);
  s.hideCols("A");
  assert.equal(s.get("D1"), 45);
  assert.equal(s.get("D2"), 3);
  assert.deepEqual(s.cells(), ["A1", "B1", "C1", "D1", "A2", "B2", "C2", "D2", "A3", "B3", "C3"]);
  assert.deepEqual(s.precedents("D2"), ["A2", "B2", "C2"]);
  assert.equal(s.display("A1"), "1");
  s.fromCSV("10,20", "A2");
  assert.equal(s.get("B2"), 20);
  assert.equal(s.get("D1"), 66);
});

test("cp49h at and count are checked as insertRows and insertCols check them", () => {
  const s = createSheet();
  s.hideRows(3);
  for (const [f, at, count] of [["hideRows", 0, 1], ["hideRows", 1, 0], ["hideRows", 9999, 2], ["showRows", 10000, 1], ["hideRows", "2", 1], ["hideRows", 1.5, 1], ["showRows", 1, -1]]) {
    assert.throws(() => s[f](at, count), thrown("#ARG", String(at)), `${f}(${at}, ${count})`);
  }
  for (const [f, at, count] of [["hideCols", 3, 1], ["hideCols", "ZZZ", 1], ["showCols", "A1", 1], ["hideCols", "ZZ", 2], ["hideCols", "", 1], ["showCols", "B", 0]]) {
    assert.throws(() => s[f](at, count), thrown("#ARG", String(at)), `${f}(${at}, ${count})`);
  }
  assert.deepEqual(s.hiddenRows(), [3]);
  assert.deepEqual(s.hiddenCols(), []);
  s.hideRows(9999);
  s.hideCols("zz");
  assert.deepEqual(s.hiddenRows(), [3, 9999]);
  assert.deepEqual(s.hiddenCols(), ["ZZ"]);
});

test("cp49h hiddenRows is in number order, hiddenCols in column order", () => {
  const s = createSheet();
  s.hideRows(10);
  s.hideRows(9);
  s.hideRows(100);
  s.hideRows(2);
  s.hideCols("AA");
  s.hideCols("b");
  s.hideCols("Z");
  assert.deepEqual(s.hiddenRows(), [2, 9, 10, 100]);
  assert.deepEqual(s.hiddenCols(), ["B", "Z", "AA"]);
  const rows = s.hiddenRows();
  rows.push(5);
  assert.deepEqual(s.hiddenRows(), [2, 9, 10, 100]);
});

test("cp49h one undo step per call that changes something", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.hideRows(2, 3);
  s.hideRows(3);
  s.showRows(7);
  s.hideCols("B");
  s.hideCols("b", 1);
  assert.equal(s.undo(), true);
  assert.deepEqual(s.hiddenCols(), []);
  assert.equal(s.undo(), true);
  assert.deepEqual(s.hiddenRows(), []);
  assert.equal(s.undo(), true);
  assert.equal(s.getInput("A1"), null);
  assert.equal(s.redo(), true);
  assert.equal(s.redo(), true);
  assert.deepEqual(s.hiddenRows(), [2, 3, 4]);
  s.showRows(1, 3);
  assert.deepEqual(s.hiddenRows(), [4]);
  assert.equal(s.undo(), true);
  assert.deepEqual(s.hiddenRows(), [2, 3, 4]);
  assert.equal(s.redo(), true);
  assert.deepEqual(s.hiddenRows(), [4]);
  assert.equal(s.redo(), false);
  assert.deepEqual(s.hiddenCols(), []);
});

test("cp49h insert and delete rows move hidden rows; added rows are visible", () => {
  const s = createSheet();
  s.set("A9996", "x");
  s.hideRows(3, 2);
  s.hideRows(9999);
  s.hideCols("C");
  s.insertRows(4, 2);
  assert.deepEqual(s.hiddenRows(), [3, 6]);
  s.insertRows(2);
  assert.deepEqual(s.hiddenRows(), [4, 7]);
  assert.equal(s.getInput("A9999"), "x");
  assert.deepEqual(s.hiddenCols(), ["C"]);
  s.deleteRows(5, 3);
  assert.deepEqual(s.hiddenRows(), [4]);
  s.deleteRows(4);
  assert.deepEqual(s.hiddenRows(), []);
  assert.equal(s.undo(), true);
  assert.deepEqual(s.hiddenRows(), [4]);
  assert.equal(s.undo(), true);
  assert.equal(s.undo(), true);
  assert.deepEqual(s.hiddenRows(), [3, 6]);
  assert.equal(s.undo(), true);
  assert.deepEqual(s.hiddenRows(), [3, 4, 9999]);
});

test("cp49h insert and delete columns move hidden columns only", () => {
  const s = createSheet();
  s.hideCols("B", 2);
  s.hideCols("ZZ");
  s.hideRows(2);
  s.insertCols("C");
  assert.deepEqual(s.hiddenCols(), ["B", "D"]);
  s.insertCols("A", 2);
  assert.deepEqual(s.hiddenCols(), ["D", "F"]);
  assert.deepEqual(s.hiddenRows(), [2]);
  s.deleteCols("e", 2);
  assert.deepEqual(s.hiddenCols(), ["D"]);
  s.insertRows(1);
  assert.deepEqual(s.hiddenCols(), ["D"]);
  assert.deepEqual(s.hiddenRows(), [3]);
  s.deleteRows(3);
  assert.deepEqual(s.hiddenRows(), []);
  assert.deepEqual(s.hiddenCols(), ["D"]);
});

test("cp49h copy and sort leave hidden rows where they are", () => {
  const s = createSheet();
  s.fromCSV("3,c\n1,a\n2,b", "A1");
  s.hideRows(2);
  s.hideCols("B");
  s.copy("A1:B3", "D1");
  assert.equal(s.getInput("D2"), "1");
  assert.equal(s.getInput("E2"), "a");
  assert.deepEqual(s.hiddenRows(), [2]);
  assert.deepEqual(s.hiddenCols(), ["B"]);
  s.sort("A1:B3", "A");
  assert.equal(s.getInput("A1"), "1");
  assert.equal(s.getInput("A2"), "2");
  assert.equal(s.getInput("B2"), "b");
  assert.deepEqual(s.hiddenRows(), [2]);
  assert.equal(s.toCSV(), "1,,3,c\n3,,2,b");
  s.undo();
  assert.equal(s.getInput("A2"), "1");
  assert.deepEqual(s.hiddenRows(), [2]);
});

test("cp49h merges and hidden rows together in toCSV", () => {
  const s = grid();
  s.merge("A1:B2");
  s.hideRows(3);
  assert.equal(s.toCSV(), "1,,3\n,,6");
  s.hideCols("A");
  assert.equal(s.toCSV({ formulas: true }), ",3\n,6");
  assert.deepEqual(s.merges(), ["A1:B2"]);
});

test("cp49h per sheet, kept by rename, not saved", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.set("A1", "1");
  d.set("A2", "2");
  d.hideRows(1);
  m.set("A1", "=SUM(Data!A1:A2)");
  assert.equal(m.get("A1"), 3);
  assert.deepEqual(m.hiddenRows(), []);
  b.renameSheet("Data", "Facts");
  assert.deepEqual(d.hiddenRows(), [1]);
  assert.equal(d.save(), '{"format":"sheet","version":1,"cells":{"A1":"1","A2":"2"},"names":{}}');
  assert.equal(d.toCSV(), "2");
});

test("cp49h CHANGES.md has a cp49 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 49);
  assert.match(lines[48], /^- cp49: \S/);
  assert.notEqual(lines[48].slice(8).toLowerCase(), "hidden rows and columns");
});
