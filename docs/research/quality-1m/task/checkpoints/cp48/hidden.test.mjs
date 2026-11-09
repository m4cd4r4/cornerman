// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
const shown = (s, c, n, from = 1) => Array.from({ length: n }, (_, i) => s.display(`${c}${i + from}`));
// Column A holds one key of each kind; column B numbers its original row.
function mixed() {
  const s = createSheet();
  s.fromCSV("b,1\n10,2\nA,3\n,4\n2,5\n=TRUE,6\n=1/0,7\na,8\n=FALSE,9\n10,10", "A1");
  return s;
}

test("cp48h ascending: numbers, text, booleans, errors, empty; stable", () => {
  const s = mixed();
  s.sort("A1:B10", "a");
  assert.deepEqual(shown(s, "A", 10), ["2", "10", "10", "A", "a", "b", "FALSE", "TRUE", "#DIV/0!", ""]);
  assert.deepEqual(shown(s, "B", 10), ["5", "2", "10", "3", "8", "1", "9", "6", "7", "4"]);
});

test("cp48h descending reverses the value groups only, and stays stable", () => {
  const s = mixed();
  s.sort("A1:B10", "A", { descending: true });
  assert.deepEqual(shown(s, "A", 10), ["TRUE", "FALSE", "b", "A", "a", "10", "10", "2", "#DIV/0!", ""]);
  assert.deepEqual(shown(s, "B", 10), ["6", "9", "1", "3", "8", "2", "10", "5", "7", "4"]);
  const t = createSheet();
  t.fromCSV("=1/0,1\n,2\n=FOO(),3\n,4\n5,5", "A1");
  t.sort("A1:B5", "A", { descending: true });
  assert.deepEqual(shown(t, "B", 5), ["5", "1", "3", "2", "4"]);
  t.sort("A1:B5", "A", { descending: false });
  assert.deepEqual(shown(t, "B", 5), ["5", "1", "3", "2", "4"]);
});

test("cp48h numbers within the tolerance are ties", () => {
  const s = createSheet();
  s.fromCSV("1.0000000001,a\n1,b\n0.5,c", "A1");
  s.sort("A1:B3", "A");
  assert.deepEqual(shown(s, "B", 3), ["c", "a", "b"]);
  s.sort("A1:B3", "A", { descending: true });
  assert.deepEqual(shown(s, "B", 3), ["a", "b", "c"]);
});

test("cp48h formulas move as typed; keys are values before the sort", () => {
  const s = createSheet();
  s.fromCSV("3\n1\n2", "A1");
  s.set("B1", "=A1*10");
  s.set("B2", "=A2*10");
  s.set("B3", "=A3*10");
  s.set("C1", "=B1");
  s.set("D1", "=SUM(A1:A3)");
  s.sort("A1:B3", "A");
  assert.deepEqual([1, 2, 3].map((r) => s.getInput(`B${r}`)), ["=A2*10", "=A3*10", "=A1*10"]);
  assert.deepEqual([1, 2, 3].map((r) => s.get(`B${r}`)), [20, 30, 10]);
  assert.equal(s.getInput("C1"), "=B1");
  assert.equal(s.get("C1"), 20);
  assert.equal(s.get("D1"), 6);
  const t = createSheet();
  t.set("A1", "=A3+1");
  t.set("A2", "5");
  t.set("A3", "1");
  t.sort("A1:A3", "A");
  assert.deepEqual([1, 2, 3].map((r) => t.getInput(`A${r}`)), ["1", "=A3+1", "5"]);
  assert.deepEqual([1, 2, 3].map((r) => t.get(`A${r}`)), [1, 6, 5]);
});

test("cp48h only the range moves; formats move, notes and rules stay", () => {
  const s = createSheet();
  s.fromCSV("3,x,keep\n1,y,keep2\n2,z,keep3", "A1");
  s.setFormat("A2", "0.00");
  s.setFormat("C2", "0%");
  s.setNote("A1", "first row");
  s.setValidation("A1", { type: "whole", min: 3, max: 3 });
  s.sort("A1:B3", "A");
  assert.deepEqual(shown(s, "A", 3), ["1.00", "2", "3"]);
  assert.deepEqual(shown(s, "B", 3), ["y", "z", "x"]);
  assert.deepEqual(shown(s, "C", 3), ["keep", "keep2", "keep3"]);
  assert.equal(s.getFormat("A2"), null);
  assert.equal(s.getFormat("C2"), "0%");
  assert.equal(s.getNote("A1"), "first row");
  assert.equal(s.getNote("A3"), null);
  assert.deepEqual(s.getValidation("A1"), { type: "whole", min: 3, max: 3 });
  assert.equal(s.getValidation("A3"), null);
  assert.deepEqual(s.invalidCells(), ["A1"]);
});

test("cp48h one undo step; no-op sorts not recorded", () => {
  const s = createSheet();
  s.fromCSV("3,c\n1,a\n2,b", "A1");
  s.setFormat("A1", "0.0");
  s.sort("A1:B3", "A");
  assert.equal(s.getFormat("A3"), "0.0");
  s.sort("A1:B3", "A");
  s.sort("B1:B3", "B");
  s.sort("A2:B2", "B");
  assert.equal(s.undo(), true);
  assert.deepEqual(shown(s, "A", 3), ["3.0", "1", "2"]);
  assert.equal(s.getFormat("A3"), null);
  assert.equal(s.redo(), true);
  assert.deepEqual(shown(s, "B", 3), ["a", "b", "c"]);
  s.undo();
  s.undo();
  s.undo();
  assert.deepEqual(s.cells(), []);
});

test("cp48h argument checks, in order, change nothing", () => {
  const s = createSheet();
  s.fromCSV("2,b\n1,a", "A1");
  s.merge("D1:D2");
  assert.throws(() => s.sort("A0:B2", "Q", 5), thrown("#ADDR", "A0:B2"));
  assert.throws(() => s.sort(null, "A"), thrown("#ADDR", "null"));
  assert.throws(() => s.sort("A1:Z9999", "Q"), thrown("#ARG", "A1:Z9999"));
  assert.throws(() => s.sort("A1:B2", "C", 5), thrown("#ARG", "C"));
  assert.throws(() => s.sort("B1:C2", "A"), thrown("#ARG", "A"));
  assert.throws(() => s.sort("A1:B2", 1), thrown("#ARG", "1"));
  assert.throws(() => s.sort("A1:B2", "A1"), thrown("#ARG", "A1"));
  assert.throws(() => s.sort("A1:B2", "AAA"), thrown("#ARG", "AAA"));
  assert.throws(() => s.sort("A1:B2", "A", { descending: "yes" }), thrown("#ARG", "opts"));
  assert.throws(() => s.sort("A1:B2", "A", null), thrown("#ARG", "opts"));
  assert.throws(() => s.sort("A1:B2", "A", true), thrown("#ARG", "opts"));
  assert.throws(() => s.sort("A1:B2", "A", [true]), thrown("#ARG", "opts"));
  assert.throws(() => s.sort("A1:D2", "A", 5), thrown("#ARG", "opts"));
  assert.throws(() => s.sort("A1:D2", "A"), thrown("#MERGE", "A1:D2"));
  assert.throws(() => s.sort("c2:d1", "c"), thrown("#MERGE", "c2:d1"));
  assert.deepEqual(shown(s, "A", 2), ["2", "1"]);
  s.sort("A1:B2", "b", {});
  assert.deepEqual(shown(s, "A", 2), ["1", "2"]);
  s.sort("A1:C2", "A", { descending: false, other: 1 });
  assert.deepEqual(shown(s, "A", 2), ["1", "2"]);
});

test("cp48h sorting a sheet of a workbook", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.fromCSV("b,2\na,1", "A1");
  m.set("A1", "=Data!B1");
  m.set("A2", "=VLOOKUP(\"b\", Data!A1:B2, 2)");
  d.sort("A1:B2", "A");
  assert.equal(m.get("A1"), 1);
  assert.equal(m.get("A2"), 2);
  assert.equal(m.getInput("A1"), "=Data!B1");
});

test("cp48h CHANGES.md has a cp48 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 48);
  assert.match(lines[47], /^- cp48: \S/);
  assert.notEqual(lines[47].slice(8).toLowerCase(), "sorting a range");
});
