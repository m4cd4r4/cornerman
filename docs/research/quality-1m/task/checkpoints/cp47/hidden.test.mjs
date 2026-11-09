// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
function sheet() {
  const s = createSheet();
  s.fromCSV("1,2,3\n4,5,6", "A1");
  s.set("C2", "=1+1");
  s.set("D1", "=SUM(A1:C2)");
  s.set("D2", "=B1");
  return s;
}

test("cp47h covered cells keep their inputs and read as empty", () => {
  const s = sheet();
  assert.equal(s.get("D1"), 17);
  s.merge("B2:a1");
  assert.deepEqual(s.merges(), ["A1:B2"]);
  assert.equal(s.get("D1"), 6);
  assert.equal(s.get("B1"), null);
  assert.equal(s.display("B1"), "");
  assert.equal(s.getInput("B1"), "2");
  assert.equal(s.get("D2"), 0);
  assert.equal(s.get("A1"), 1);
  assert.deepEqual(s.cells(), ["A1", "B1", "C1", "D1", "A2", "B2", "C2", "D2"]);
  s.set("E1", '=B1&"|"&A1');
  assert.equal(s.get("E1"), "|1");
  s.defineName("COVERED", "B2");
  s.set("E2", "=COVERED+10");
  assert.equal(s.get("E2"), 10);
  assert.equal(s.unmerge("A2"), true);
  assert.equal(s.get("D1"), 17);
  assert.equal(s.get("E1"), "2|1");
  assert.equal(s.get("E2"), 15);
  assert.equal(s.get("D2"), 2);
});

test("cp47h covered formulas are not evaluated; graph from text", () => {
  const s = sheet();
  s.get("D1");
  s.set("C3", "=C2*10");
  s.merge("C1:C2");
  const before = s.stats().evaluations;
  assert.equal(s.get("C2"), null);
  assert.equal(s.get("C3"), 0);
  assert.deepEqual(s.recalc(), ["D1", "D2"]);
  assert.equal(s.get("C2"), null);
  assert.ok(s.stats().evaluations - before <= 3);
  assert.deepEqual(s.recalc(), []);
  assert.deepEqual(s.precedents("C3"), ["C2"]);
  assert.deepEqual(s.dependents("C2"), ["D1", "C3"]);
  s.set("C3", "=C3+C2");
  assert.ok(s.get("C3") && s.get("C3").code === "#CYCLE!");
  s.set("C3", "=C2*10");
  s.unmerge("C1");
  assert.equal(s.get("C3"), 20);
});

test("cp47h toCSV writes empty fields for covered cells in both modes", () => {
  const s = sheet();
  s.merge("B1:C2");
  assert.equal(s.toCSV(), "1,2,,7\n4,,,2");
  assert.equal(s.toCSV({ formulas: true }), "1,2,,=SUM(A1:C2)\n4,,,=B1");
});

test("cp47h set, setCell, setMany and fromCSV refuse covered cells", () => {
  const s = sheet();
  s.merge("A1:B2");
  assert.throws(() => s.set("b1", "9"), thrown("#MERGE", "B1"));
  assert.throws(() => s.setCell("A2", ""), thrown("#MERGE", "A2"));
  assert.throws(() => s.setMany({ C1: "7", B2: "8" }), thrown("#MERGE", "B2"));
  assert.throws(() => s.setMany({ B2: "8", ZZZ1: "1" }), thrown("#ADDR", "ZZZ1"));
  assert.throws(() => s.fromCSV("9,9", "A1"), thrown("#MERGE", "B1"));
  assert.throws(() => s.fromCSV("9,9", "A0"), (e) => e.code === "#ADDR");
  assert.equal(s.getInput("C1"), "3");
  assert.equal(s.getInput("B1"), "2");
  s.set("A1", "10");
  assert.equal(s.get("D1"), 15);
  s.setValidation("B1", { type: "whole", min: 1, max: 5 });
  s.setValidation("E5", { type: "whole", min: 1, max: 5 });
  assert.throws(() => s.set("B1", "99"), thrown("#MERGE", "B1"));
  assert.throws(() => s.setMany({ E5: "99", B1: "3" }), thrown("#INVALID", "E5"));
  assert.throws(() => s.setMany({ B1: "3", E5: "99" }), thrown("#MERGE", "B1"));
  s.fromCSV("11", "A1");
  assert.equal(s.get("A1"), 11);
});

test("cp47h copy ignores merges", () => {
  const s = sheet();
  s.merge("A1:B1");
  s.merge("D5:E5");
  s.copy("A1:B1", "D5");
  assert.equal(s.getInput("D5"), "1");
  assert.equal(s.getInput("E5"), "2");
  assert.equal(s.get("E5"), null);
  s.copy("A1:B1", "A8");
  assert.equal(s.get("B8"), 2);
  assert.deepEqual(s.merges(), ["A1:B1", "D5:E5"]);
  s.undo();
  s.undo();
  assert.equal(s.getInput("E5"), null);
  assert.equal(s.undo(), true);
  assert.deepEqual(s.merges(), ["A1:B1"]);
  assert.equal(s.redo(), true);
  assert.deepEqual(s.merges(), ["A1:B1", "D5:E5"]);
});

test("cp47h undo steps; merges() in top-left row-major order", () => {
  const s = createSheet();
  s.merge("C1:D1");
  s.merge("A3:B4");
  s.merge("A1:A2");
  s.merge("E1:E9");
  assert.deepEqual(s.merges(), ["A1:A2", "C1:D1", "E1:E9", "A3:B4"]);
  assert.equal(s.unmerge("Z9"), false);
  assert.equal(s.unmerge("E5"), true);
  assert.equal(s.undo(), true);
  assert.deepEqual(s.merges(), ["A1:A2", "C1:D1", "E1:E9", "A3:B4"]);
  assert.equal(s.undo(), true);
  assert.equal(s.undo(), true);
  assert.deepEqual(s.merges(), ["C1:D1", "A3:B4"]);
  assert.equal(s.redo(), true);
  assert.deepEqual(s.merges(), ["A1:A2", "C1:D1", "A3:B4"]);
  assert.throws(() => s.unmerge("1A"), thrown("#ADDR", "1A"));
});

test("cp47h merge errors, in order, change nothing", () => {
  const s = createSheet();
  s.merge("B2:C3");
  for (const [t, code] of [["A0:B1", "#ADDR"], ["B2", "#MERGE"], ["A1", "#MERGE"], ["A1:B2", "#MERGE"], ["C3:D4", "#MERGE"], ["A2:Z2", "#MERGE"], ["B2:C3", "#MERGE"], ["A1:Z9999", "#ARG"], ["c2:c2", "#MERGE"]]) {
    assert.throws(() => s.merge(t), thrown(code, t), t);
  }
  assert.throws(() => s.merge(null), thrown("#ADDR", "null"));
  assert.deepEqual(s.merges(), ["B2:C3"]);
  s.merge("D1:D3");
  s.merge("A4:C4");
  assert.deepEqual(s.merges(), ["D1:D3", "B2:C3", "A4:C4"]);
});

test("cp47h insert and delete move and resize merges", () => {
  const s = createSheet();
  s.set("B3", "hidden");
  s.merge("A2:B3");
  s.merge("D1:E1");
  s.insertRows(3, 2);
  assert.deepEqual(s.merges(), ["D1:E1", "A2:B5"]);
  assert.equal(s.get("B5"), null);
  assert.equal(s.getInput("B5"), "hidden");
  s.insertRows(2, 1);
  assert.deepEqual(s.merges(), ["D1:E1", "A3:B6"]);
  s.insertCols("E", 1);
  assert.deepEqual(s.merges(), ["D1:F1", "A3:B6"]);
  s.deleteCols("D", 2);
  assert.deepEqual(s.merges(), ["A3:B6"]);
  s.deleteRows(3, 3);
  assert.deepEqual(s.merges(), ["A3:B3"]);
  s.deleteCols("A", 1);
  assert.deepEqual(s.merges(), []);
  assert.equal(s.get("A3"), "hidden");
  s.undo();
  assert.deepEqual(s.merges(), ["A3:B3"]);
  s.undo();
  assert.deepEqual(s.merges(), ["A3:B6"]);
  assert.equal(s.getInput("B6"), "hidden");
  assert.equal(s.get("B6"), null);
  s.deleteRows(6, 1);
  assert.equal(s.getInput("B6"), null);
  assert.deepEqual(s.merges(), ["A3:B5"]);
  s.deleteRows(1, 9);
  assert.deepEqual(s.merges(), []);
});

test("cp47h merges are per sheet; other sheets read covered cells as empty", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.set("A1", "5");
  d.set("A2", "7");
  m.set("A1", "=Data!A2+SUM(Data!A1:A2)");
  assert.equal(m.get("A1"), 19);
  d.merge("A1:A2");
  assert.equal(m.get("A1"), 5);
  assert.deepEqual(m.merges(), []);
  b.renameSheet("Data", "Facts");
  assert.deepEqual(d.merges(), ["A1:A2"]);
  assert.equal(m.get("A1"), 5);
  d.unmerge("A1");
  assert.equal(m.get("A1"), 19);
});

test("cp47h CHANGES.md has a cp47 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 47);
  assert.match(lines[46], /^- cp47: \S/);
  assert.notEqual(lines[46].slice(8).toLowerCase(), "merged ranges");
});
