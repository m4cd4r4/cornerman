// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook, loadSheet, loadWorkbook } from "../../src/index.mjs";

const brief = (list) => list.map((x) => `${x.sheet === null ? "-" : x.sheet}:${x.label}`);

test("cp76h every method that makes a step is its own label", () => {
  const s = createSheet();
  s.set("A1", "3");
  s.setCell("A2", "1");
  s.setMany({ A3: "2", B1: "=A1" });
  s.copy("B1", "B2");
  s.fromCSV("5,6", "C1");
  s.insertRows(1);
  s.deleteRows(1);
  s.insertCols("A");
  s.deleteCols("A");
  s.defineName("N", "A1");
  s.defineConstant("K", 1);
  s.removeName("K");
  s.setFormat("A1", "0.00");
  s.setNote("A1", "n");
  s.setValidation("D1", { type: "whole", min: 1, max: 9 });
  s.merge("E1:F1");
  s.unmerge("E1");
  s.sort("A1:A3", "A");
  s.hideRows(5);
  s.showRows(5);
  s.hideCols("G");
  s.showCols("G");
  s.replace("5", "7");
  s.fillDown("B1:B3");
  s.fillRight("A1:C1");
  s.clear("C1");
  assert.deepEqual(s.undoList(), [
    "clear", "fillRight", "fillDown", "replace", "showCols", "hideCols", "showRows", "hideRows", "sort", "unmerge", "merge",
    "setValidation", "setNote", "setFormat", "removeName", "defineConstant", "defineName", "deleteCols", "insertCols",
    "deleteRows", "insertRows", "fromCSV", "copy", "setMany", "setCell", "set",
  ]);
});

test("cp76h calls that change nothing make no step; undo and redo keep labels", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.setCell("A1", "1");
  s.setMany({ A1: "1" });
  s.setFormat("B1", null);
  s.removeName("NONE");
  s.clear("Z9");
  s.replace("nothing", "x");
  assert.deepEqual(s.undoList(), ["set"]);
  s.setCell("A1", "2");
  s.set("A1", "3");
  s.undo();
  s.undo();
  assert.deepEqual(s.undoList(), ["set"]);
  assert.deepEqual(s.redoList(), ["setCell", "set"]);
  s.redo();
  assert.deepEqual(s.undoList(), ["setCell", "set"]);
  assert.deepEqual(s.redoList(), ["set"]);
  s.setMany({ B1: "x" });
  assert.deepEqual(s.redoList(), []);
  assert.deepEqual(s.undoList(), ["setMany", "setCell", "set"]);
});

test("cp76h the lists are new arrays and change nothing", () => {
  const s = createSheet();
  s.set("A1", "1");
  const u = s.undoList();
  u.push("x");
  u[0] = "y";
  assert.deepEqual(s.undoList(), ["set"]);
  assert.equal(s.getInput("A1"), "1");
  assert.equal(s.undo(), true);
  assert.equal(s.undo(), false);
  const b = createWorkbook();
  b.addSheet("Main").set("A1", "1");
  const l = b.undoList();
  l[0].label = "z";
  assert.deepEqual(brief(b.undoList()), ["Main:set"]);
});

test("cp76h workbook steps: book.copy on the target, names with a null sheet", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("data");
  m.setMany({ A1: "1", A2: "=A1" });
  b.copy("Main!A1:A2", "data!B1");
  b.copy("Main!A1", "Main!C1");
  b.defineName("T", "data!B1");
  b.defineConstant("R", 2);
  b.removeName("R");
  assert.deepEqual(m.undoList(), ["copy", "setMany"]);
  assert.deepEqual(d.undoList(), ["copy"]);
  assert.deepEqual(brief(b.undoList()), ["-:removeName", "-:defineConstant", "-:defineName", "Main:copy", "data:copy", "Main:setMany"]);
});

test("cp76h a batch labels each step with the call inside it, and a rollback restores the lists", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  m.set("A1", "1");
  b.batch((book) => {
    m.setCell("A2", "2");
    book.get("Data").setNote("A1", "x");
    book.defineConstant("K", 1);
  });
  assert.deepEqual(brief(b.undoList()), ["-:defineConstant", "Data:setNote", "Main:setCell", "Main:set"]);
  assert.ok(!JSON.stringify(b.undoList()).includes("batch"));
  m.undo();
  assert.throws(() => b.batch(() => { m.set("B1", "1"); d.setCell("B1", "2"); b.removeName("K"); throw new Error("no"); }), /no/);
  assert.deepEqual(m.undoList(), ["set"]);
  assert.deepEqual(m.redoList(), ["setCell"]);
  assert.deepEqual(d.undoList(), ["setNote"]);
  assert.deepEqual(brief(b.undoList()), ["-:defineConstant", "Data:setNote", "Main:set"]);
  assert.deepEqual(brief(b.redoList()), ["Main:setCell"]);
});

test("cp76h a step made by a change listener carries the listener's own call", () => {
  const s = createSheet();
  s.onChange((e) => { if (e.cells.includes("A1")) s.setMany({ B1: "seen" }); });
  s.setCell("A1", "1");
  assert.deepEqual(s.undoList(), ["setMany", "setCell"]);
  s.fromCSV("2", "A1");
  assert.deepEqual(s.undoList(), ["fromCSV", "setMany", "setCell"]);
});

test("cp76h book lists are by time across sheets, not sheet by sheet", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  m.set("A1", "1");
  d.set("A1", "1");
  m.setCell("A2", "2");
  d.setCell("A2", "2");
  assert.deepEqual(brief(b.undoList()), ["Data:setCell", "Main:setCell", "Data:set", "Main:set"]);
  m.undo();
  d.undo();
  m.undo();
  assert.deepEqual(brief(b.undoList()), ["Data:set"]);
  assert.deepEqual(brief(b.redoList()), ["Main:set", "Data:setCell", "Main:setCell"]);
  b.redo();
  assert.deepEqual(brief(b.undoList()), ["Main:set", "Data:set"]);
  assert.deepEqual(brief(b.redoList()), ["Data:setCell", "Main:setCell"]);
  d.redo();
  b.undo();
  assert.deepEqual(brief(b.undoList()), ["Main:set", "Data:set"]);
  assert.deepEqual(brief(b.redoList()), ["Data:setCell", "Main:setCell"]);
  b.removeSheet("Data");
  assert.deepEqual(brief(b.undoList()), ["Main:set"]);
  assert.deepEqual(brief(b.redoList()), ["Main:setCell"]);
  assert.deepEqual(d.undoList(), ["set"]);
  assert.deepEqual(d.redoList(), ["setCell"]);
});

test("cp76h at most 100 steps, the oldest dropped", () => {
  const s = createSheet();
  s.setMany({ Z1: "first" });
  for (let i = 1; i <= 100; i++) (i % 2 ? s.set : s.setCell)("A1", String(i));
  const u = s.undoList();
  assert.equal(u.length, 100);
  assert.equal(u[0], "setCell");
  assert.equal(u[99], "set");
  assert.ok(!u.includes("setMany"));
  const b = createWorkbook();
  for (let i = 1; i <= 102; i++) b.defineConstant("K", i);
  assert.equal(b.undoList().length, 100);
});

test("cp76h rename and delete clear the lists; loading starts empty", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  m.set("A1", "=Data!A1");
  d.set("A1", "1");
  b.defineConstant("K", 1);
  m.undo();
  b.renameSheet("Data", "Facts");
  assert.deepEqual(b.undoList(), []);
  assert.deepEqual(b.redoList(), []);
  assert.deepEqual(m.redoList(), []);
  d.set("A2", "2");
  assert.deepEqual(brief(b.undoList()), ["Facts:set"]);
  m.set("B1", "1");
  b.deleteSheet("Facts");
  assert.deepEqual(b.undoList(), []);
  assert.deepEqual(m.undoList(), []);
  assert.deepEqual(d.undoList(), []);
  m.set("B2", "2");
  assert.deepEqual(loadSheet(m.save()).undoList(), []);
  assert.deepEqual(loadWorkbook(b.save()).undoList(), []);
  assert.deepEqual(loadWorkbook(b.save()).get("Main").undoList(), []);
});

test("cp76h a sheet's lists hold its own steps only", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  b.addSheet("Data").set("A1", "1");
  b.defineName("X", "Data!A1");
  m.set("A1", "=X");
  assert.deepEqual(m.undoList(), ["set"]);
  b.undo();
  b.undo();
  assert.deepEqual(m.undoList(), []);
  assert.deepEqual(m.redoList(), ["set"]);
  assert.deepEqual(brief(b.redoList()), ["-:defineName", "Main:set"]);
});

test("cp76h CHANGES.md has a cp76 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 76);
  assert.match(lines[75], /^- cp76: \S/);
  assert.notEqual(lines[75].slice(8).toLowerCase(), "undo history labels");
});
