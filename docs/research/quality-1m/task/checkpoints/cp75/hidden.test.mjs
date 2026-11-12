// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook, loadSheet, loadWorkbook, diffWorkbooks } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
const logOf = (x) => x.deprecations().map((e) => `${e.name}>${e.use}x${e.calls}`);

test("cp75h cell: formats, decimal comma, errors, covered cells, one evaluation", () => {
  const s = createSheet({ decimal: "," });
  s.setMany({ A1: "0.25", B1: "=A1*2", C1: "=1/0", D1: "x", E1: "hidden" });
  s.setFormat("A1", "0%");
  assert.deepEqual(s.cell("a1"), { address: "A1", input: "0.25", value: 0.25, text: "25%" });
  assert.deepEqual(s.cell("B1"), { address: "B1", input: "=A1*2", value: 0.5, text: "0,5" });
  const c = s.cell("C1");
  assert.equal(c.value.code, "#DIV/0!");
  assert.equal(c.value.cell, "C1");
  assert.equal(c.text, "#DIV/0!");
  s.merge("D1:E1");
  assert.deepEqual(s.cell("E1"), { address: "E1", input: "hidden", value: null, text: "" });
  assert.deepEqual(s.cell("z1"), { address: "Z1", input: "", value: null, text: "" });
  assert.equal(s.stats().evaluations, 2);
  s.cell("B1").value = 9;
  assert.equal(s.cell("B1").value, 0.5);
  assert.equal(s.stats().evaluations, 2);
  for (const bad of ["A0", "", null, "A1:B2"]) assert.throws(() => s.cell(bad), thrown("#ADDR", bad));
});

test("cp75h clear counts the cells it empties; nothing to clear is no undo step", () => {
  const s = createSheet();
  s.setMany({ A1: "1", C3: "=A1", Z9: "far" });
  assert.equal(s.clear("B2"), 0);
  assert.equal(s.clear("b1:a2"), 1);
  assert.equal(s.clear("A1:C3"), 1);
  assert.equal(s.clear("A1:C3"), 0);
  assert.deepEqual(s.addresses(), ["Z9"]);
  assert.equal(s.undo(), true);
  assert.deepEqual(s.addresses(), ["C3", "Z9"]);
  assert.equal(s.undo(), true);
  assert.deepEqual(s.addresses(), ["A1", "C3", "Z9"]);
  assert.equal(s.get("C3"), 1);
  assert.equal(s.undo(), true);
  assert.deepEqual(s.addresses(), []);
  assert.equal(s.redo(), true);
  assert.equal(s.redo(), true);
  assert.deepEqual(s.addresses(), ["C3", "Z9"]);
  assert.equal(s.get("C3"), 0);
});

test("cp75h clear removes inputs only; covered cells keep their hidden inputs", () => {
  const s = createSheet();
  s.setMany({ A1: "5", B1: "under", A2: "7", A3: "3" });
  s.setFormat("A2", "0.00");
  s.setNote("A2", "kept");
  s.setValidation("A3", { type: "whole", min: 1, max: 9 });
  s.merge("A1:B1");
  s.hideRows(3);
  assert.equal(s.clear("A1:B3"), 3);
  assert.deepEqual(s.addresses(), ["B1"]);
  assert.equal(s.getFormat("A2"), "0.00");
  assert.equal(s.getNote("A2"), "kept");
  assert.deepEqual(s.getValidation("A3"), { type: "whole", min: 1, max: 9 });
  assert.deepEqual(s.merges(), ["A1:B1"]);
  assert.deepEqual(s.hiddenRows(), [3]);
  s.unmerge("A1");
  assert.equal(s.value("B1"), "under");
  assert.equal(s.clear("B1"), 1);
  assert.deepEqual(s.addresses(), []);
});

test("cp75h clear and protection: a locked cell with an input refuses, an empty one does not", () => {
  const s = createSheet();
  s.setMany({ A1: "1", B2: "2", C3: "3" });
  s.protect("C3");
  s.protect("B2");
  s.protect("A2");
  assert.throws(() => s.clear("A1:C3"), thrown("#LOCKED", "B2"));
  assert.deepEqual(s.addresses(), ["A1", "B2", "C3"]);
  assert.equal(s.clear("A1:A2"), 1);
  s.unprotect("B2");
  assert.throws(() => s.clear("B2:C3"), thrown("#LOCKED", "C3"));
  assert.equal(s.formula("B2"), "2");
  assert.equal(s.undo(), true);
  assert.equal(s.formula("A1"), "1");
});

test("cp75h clear checks its target first and fires one change event", () => {
  const s = createSheet();
  s.setMany({ A1: "1", A2: "2" });
  for (const [t, code, cell] of [["A0", "#ADDR", "A0"], [null, "#ADDR", "null"], ["A1:B2:C3", "#ADDR", "A1:B2:C3"], ["A1:B5001", "#ARG", "A1:B5001"]]) {
    assert.throws(() => s.clear(t), thrown(code, cell), String(t));
  }
  const seen = [];
  s.onChange((e) => seen.push(e.cells));
  s.clear("A1:A5");
  s.clear("A1:A5");
  assert.deepEqual(seen, [["A1", "A2"]]);
});

test("cp75h every old name is logged in the order first called, with its replacement", () => {
  const s = createSheet();
  s.getInput("A1");
  s.cells();
  s.display("A1");
  s.set("A1", "1");
  s.get("A1");
  s.cells();
  s.getInput("A1");
  assert.deepEqual(logOf(s), ["getInput>formulax2", "cells>addressesx2", "display>textx1", "set>setCellx1", "get>valuex1"]);
  assert.deepEqual(s.deprecations()[0], { name: "getInput", use: "formula", calls: 2 });
});

test("cp75h a call that throws still counts", () => {
  const s = createSheet();
  assert.throws(() => s.get("A0"), thrown("#ADDR", "A0"));
  assert.throws(() => s.set("ZZZ1", "1"), thrown("#ADDR", "ZZZ1"));
  assert.throws(() => s.getInput(5), thrown("#ADDR", 5));
  s.setValidation("B1", { type: "list", items: ["a"] });
  assert.throws(() => s.set("B1", "b"), thrown("#INVALID", "B1"));
  assert.deepEqual(logOf(s), ["get>valuex1", "set>setCellx2", "getInput>formulax1"]);
});

test("cp75h calls the library makes never count", () => {
  const b = createWorkbook();
  const s = b.addSheet("Main");
  const d = b.addSheet("Data");
  s.setCell("A1", "1");
  s.setMany({ A2: "=A1+1", A3: "x" });
  s.value("A2");
  s.text("A2");
  s.addresses();
  s.formula("A9");
  s.cell("A2");
  s.clear("A3");
  s.copy("A1:A2", "B1");
  s.fillDown("C1:C3");
  s.toCSV();
  s.fromCSV("4,5", "D1");
  s.recalc();
  s.explain("A2");
  s.errorCells();
  s.canonical("A2");
  s.sort("A1:A2", "A");
  s.replace("x", "y");
  s.find("1");
  s.undo();
  s.redo();
  s.save();
  b.get("Data").setCell("A1", "1");
  b.copy("Main!A1:A2", "Data!B1");
  b.errorCells();
  b.save();
  diffWorkbooks(b.save(), b.save());
  assert.deepEqual(s.deprecations(), []);
  assert.deepEqual(d.deprecations(), []);
  assert.deepEqual(b.deprecations(), []);
});

test("cp75h your calls count inside a change listener and inside a batch, even one that rolls back", () => {
  const b = createWorkbook();
  const s = b.addSheet("Main");
  s.onChange(() => { s.get("A1"); });
  s.setCell("A1", "1");
  s.setCell("A2", "2");
  assert.deepEqual(logOf(s), ["get>valuex2"]);
  assert.throws(() => b.batch(() => { s.set("A3", "3"); b.sheet("Main").getInput("A3"); throw new Error("stop"); }), /stop/);
  assert.equal(s.formula("A3"), "");
  assert.deepEqual(logOf(s), ["get>valuex2", "set>setCellx1", "getInput>formulax1"]);
  assert.deepEqual(logOf(b), ["sheet>getx1"]);
  b.batch(() => s.set("A4", "4"));
  assert.deepEqual(logOf(s), ["get>valuex3", "set>setCellx2", "getInput>formulax1"]);
});

test("cp75h the log is not content: not undone, not saved, kept on a removed sheet, one per sheet", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  m.set("A1", "1");
  m.undo();
  assert.deepEqual(logOf(m), ["set>setCellx1"]);
  assert.deepEqual(logOf(d), []);
  d.cells();
  const copy = loadSheet(m.save());
  assert.deepEqual(copy.deprecations(), []);
  const book = loadWorkbook(b.save());
  assert.deepEqual(book.deprecations(), []);
  assert.deepEqual(book.get("Main").deprecations(), []);
  b.removeSheet("Main");
  m.get("A1");
  assert.deepEqual(logOf(m), ["set>setCellx1", "get>valuex1"]);
  assert.deepEqual(logOf(d), ["cells>addressesx1"]);
  assert.deepEqual(logOf(b), []);
});

test("cp75h book.sheet is logged on the book, also when it throws; book.get is not", () => {
  const b = createWorkbook();
  b.addSheet("Main");
  b.get("main");
  assert.deepEqual(b.deprecations(), []);
  b.sheet("MAIN").setCell("A1", "1");
  assert.throws(() => b.sheet("Nope"), thrown("#SHEET", "Nope"));
  assert.throws(() => b.get("Nope"), thrown("#SHEET", "Nope"));
  assert.deepEqual(b.deprecations(), [{ name: "sheet", use: "get", calls: 2 }]);
  assert.deepEqual(b.get("Main").deprecations(), []);
  const list = b.deprecations();
  list[0].calls = 99;
  list.push({});
  assert.deepEqual(b.deprecations(), [{ name: "sheet", use: "get", calls: 2 }]);
});

test("cp75h the old names still do exactly what they did", () => {
  const s = createSheet();
  s.set("a1", "=1/4");
  assert.equal(s.get("A1"), 0.25);
  assert.equal(s.display("A1"), "0.25");
  assert.equal(s.getInput("A2"), null);
  assert.equal(s.formula("A2"), "");
  assert.deepEqual(s.cells(), ["A1"]);
  assert.equal(s.set("A2", "x"), undefined);
  assert.deepEqual(logOf(s), ["set>setCellx2", "get>valuex1", "display>textx1", "getInput>formulax1", "cells>addressesx1"]);
});

test("cp75h CHANGES.md has a cp75 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 75);
  assert.match(lines[74], /^- cp75: \S/);
  assert.notEqual(lines[74].slice(8).toLowerCase(), "api v3 and deprecations");
});

test("cp75h recall: cell() on a formula that reads an error from another sheet gives that error with its own cell", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.set("C5", "=1/0");
  m.set("B2", "=Data!C5");
  const c = m.cell("b2");
  assert.equal(c.address, "B2");
  assert.equal(c.value.code, "#DIV/0!");
  assert.equal(c.value.cell, "C5");
});
