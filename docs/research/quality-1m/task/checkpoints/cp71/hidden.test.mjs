// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook, loadWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
const locked = (cell) => thrown("#LOCKED", cell);
const inputs = (s) => Object.fromEntries(s.cells().map((k) => [k, s.getInput(k)]));

test("cp71h protect, unprotect and their errors", () => {
  const s = createSheet();
  assert.equal(s.protect("b2:a1"), undefined);
  assert.equal(s.protect("A1"), undefined);
  assert.equal(s.unprotect("C9"), undefined);
  assert.deepEqual(s.protectedCells(), ["A1", "B1", "A2", "B2"]);
  assert.equal(s.isProtected("C3"), false);
  for (const [t, code, cell] of [["A0", "#ADDR", "A0"], [null, "#ADDR", "null"], ["A1:B2:C3", "#ADDR", "A1:B2:C3"], ["$A$1", "#ADDR", "$A$1"], ["A1:Z1000", "#ARG", "A1:Z1000"]]) {
    assert.throws(() => s.protect(t), thrown(code, cell), String(t));
    assert.throws(() => s.unprotect(t), thrown(code, cell), String(t));
  }
  assert.throws(() => s.isProtected("A0"), thrown("#ADDR", "A0"));
  s.unprotect("A1:B1");
  assert.deepEqual(s.protectedCells(), ["A2", "B2"]);
});

test("cp71h only a change is refused; an empty protected cell refuses too", () => {
  const s = createSheet();
  s.setMany({ A1: "1", A2: "=A1" });
  s.protect("A1:A3");
  s.set("A1", "1");
  s.setCell("A2", "=A1");
  s.setMany({ A1: "1", B1: "x" });
  assert.throws(() => s.set("A1", "1.0"), locked("A1"));
  assert.throws(() => s.set("A1", ""), locked("A1"));
  assert.throws(() => s.set("a3", "new"), locked("A3"));
  assert.throws(() => s.setCell("A2", "=a1"), locked("A2"));
  s.set("A3", "");
  assert.deepEqual(inputs(s), { A1: "1", B1: "x", A2: "=A1" });
  assert.equal(s.undo(), true);
  assert.equal(s.getInput("B1"), null);
});

test("cp71h setMany, fromCSV, fill and replace refuse before writing anything", () => {
  const s = createSheet();
  s.setMany({ A1: "1", A2: "2", C1: "c" });
  s.protect("B2");
  s.protect("C1");
  assert.throws(() => s.setMany({ D1: "1", C1: "d", b2: "e" }), locked("C1"));
  assert.throws(() => s.setMany({ D1: "1", b2: "e", C1: "d" }), locked("B2"));
  assert.throws(() => s.fromCSV("p,q,r\ns,t", "A1"), locked("C1"));
  s.fromCSV("1,,c", "A1");
  assert.equal(s.getInput("B1"), null);
  assert.throws(() => s.fillRight("A2:C2"), locked("B2"));
  s.fillDown("C1:C1");
  s.set("B1", "c");
  assert.throws(() => s.replace("c", "C", { matchCase: true }), locked("C1"));
  assert.equal(s.replace("c", "c"), 0);
  assert.deepEqual(inputs(s), { A1: "1", B1: "c", C1: "c", A2: "2" });
});

test("cp71h a fill or copy that writes the same text into a protected cell is allowed", () => {
  const s = createSheet();
  s.setMany({ A1: "5", A2: "5", A3: "5", B1: "=A1", B2: "=A2" });
  s.protect("A2:A3");
  s.protect("B2:B3");
  s.fillDown("A1:A3");
  s.fillDown("B1:B2");
  s.copy("B1", "B2");
  assert.throws(() => s.fillDown("B1:B3"), locked("B3"));
  s.set("A1", "1");
  assert.deepEqual(inputs(s), { A1: "1", B1: "=A1", A2: "5", B2: "=A2", A3: "5" });
});

test("cp71h copy, book.copy and sort check protection after their own checks", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.setMany({ A1: "3", A2: "1", A3: "2" });
  m.setMany({ A1: "x", B1: "y" });
  m.protect("B1");
  assert.throws(() => m.copy("A1", "B1"), locked("B1"));
  assert.throws(() => m.copy("A1:A2", "ZZ9999"), thrown("#ARG", "ZZ9999"));
  assert.throws(() => b.copy("Data!A1:A3", "Main!B1"), locked("B1"));
  assert.throws(() => b.copy("Data!A1", "Main!ZZ9999:A1"), thrown("#ADDR", "Main!ZZ9999:A1"));
  b.copy("Main!B1", "Main!B1");
  m.copy("A1", "C1");
  assert.equal(m.getInput("C1"), "x");
  d.protect("A2");
  assert.throws(() => d.sort("A1:A3", "A"), locked("A2"));
  d.merge("C1:C2");
  assert.throws(() => d.sort("A1:C3", "A"), thrown("#MERGE", "A1:C3"));
  d.set("A2", "1");
  d.setMany({ A1: "0" });
  d.sort("A1:A3", "A");
  assert.deepEqual([d.get("A1"), d.get("A2"), d.get("A3")], [0, 1, 2]);
  assert.equal(d.isProtected("A2"), true);
  assert.equal(m.isProtected("C1"), false);
});

test("cp71h each cell: merge, then protection, then limits, then rules", () => {
  const s = createSheet();
  s.merge("A1:B1");
  s.protect("B1:C1");
  s.setValidation("C1:D1", { type: "whole", min: 1, max: 2 });
  const long = "=1" + "+1".repeat(500);
  assert.throws(() => s.set("B1", "x"), thrown("#MERGE", "B1"));
  assert.throws(() => s.set("C1", long), locked("C1"));
  assert.throws(() => s.set("C1", "9"), locked("C1"));
  assert.throws(() => s.setMany({ D1: "9", C1: "1" }), thrown("#INVALID", "D1"));
  assert.throws(() => s.setMany({ C1: "1", D1: "9" }), locked("C1"));
});

test("cp71h undo and redo never check protection; protect is not an undo step", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.set("A2", "2");
  s.undo();
  s.protect("A1:A2");
  s.unprotect("A2");
  s.protect("A2");
  assert.equal(s.redo(), true);
  assert.equal(s.getInput("A2"), "2");
  assert.equal(s.undo(), true);
  assert.equal(s.undo(), true);
  assert.equal(s.getInput("A1"), null);
  assert.equal(s.undo(), false);
  assert.deepEqual(s.protectedCells(), ["A1", "A2"]);
  assert.equal(s.redo(), true);
  assert.equal(s.getInput("A1"), "1");
});

test("cp71h insert and delete move protection; undo puts it back as it was", () => {
  const s = createSheet();
  s.setMany({ A1: "1", B2: "=A1*2" });
  s.protect("B2");
  s.protect("A5");
  s.insertRows(1);
  assert.deepEqual(s.protectedCells(), ["B3", "A6"]);
  assert.equal(s.getInput("B3"), "=A2*2");
  assert.equal(s.isProtected("B2"), false);
  s.insertCols("A");
  assert.deepEqual(s.protectedCells(), ["C3", "B6"]);
  s.deleteRows(6);
  assert.deepEqual(s.protectedCells(), ["C3"]);
  s.unprotect("C3");
  s.protect("Z9");
  assert.equal(s.undo(), true);
  assert.deepEqual(s.protectedCells(), ["C3", "B6"]);
  s.undo();
  s.undo();
  assert.deepEqual(s.protectedCells(), ["B2", "A5"]);
  assert.equal(s.getInput("B2"), "=A1*2");
});

test("cp71h rename, delete sheet and batch rollback", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  b.addSheet("Data");
  b.addSheet("Gone");
  m.setMany({ A1: "=Data!A1", A2: "=Gone!A1" });
  m.protect("A1:A2");
  b.renameSheet("Data", "Facts");
  b.deleteSheet("Gone");
  assert.deepEqual(inputs(m), { A1: "=Facts!A1", A2: "=#REF!" });
  assert.throws(() => b.batch(() => { m.unprotect("A1"); m.set("A1", "1"); m.protect("B1"); throw new Error("no"); }), /no/);
  assert.deepEqual(m.protectedCells(), ["A1", "A2"]);
  assert.equal(m.getInput("A1"), "=Facts!A1");
});

test("cp71h other layers can be set; copy carries no protection", () => {
  const s = createSheet();
  s.set("A1", "0.5");
  s.protect("A1");
  s.setFormat("A1", "0%");
  s.setNote("A1", "n");
  s.setValidation("A1", { type: "list", items: ["x"] });
  s.merge("A1:B1");
  assert.equal(s.display("A1"), "50%");
  s.unmerge("A1");
  s.copy("A1", "C1");
  assert.equal(s.isProtected("C1"), false);
  assert.equal(s.getInput("C1"), "0.5");
  s.fillRight("C1:D1");
  assert.deepEqual(s.protectedCells(), ["A1"]);
});

test("cp71h protection is not saved and fires no event", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  m.set("A1", "1");
  const plain = b.save();
  const sheetPlain = m.save();
  const seen = [];
  m.onChange((e) => seen.push(e.cells));
  m.protect("A1:C3");
  m.unprotect("B2");
  assert.deepEqual(seen, []);
  assert.equal(b.save(), plain);
  assert.equal(m.save(), sheetPlain);
  assert.deepEqual(loadWorkbook(b.save()).sheet("Main").protectedCells(), []);
  assert.throws(() => m.set("A1", "2"), locked("A1"));
  assert.deepEqual(seen, []);
});

test("cp71h CHANGES.md has a cp71 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 71);
  assert.match(lines[70], /^- cp71: \S/);
  assert.notEqual(lines[70].slice(8).toLowerCase(), "protected cells");
});
