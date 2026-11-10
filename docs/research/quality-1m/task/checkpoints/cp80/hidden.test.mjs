// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as pkg from "../../src/index.mjs";

const { apiIndex, createSheet, createWorkbook, loadSheet, loadWorkbook } = pkg;

const EXPORTS = ["apiIndex", "createSheet", "createWorkbook", "diffWorkbooks", "loadSheet", "loadWorkbook"];
const SHEET = `addresses, canonical, cell, cells, clear, copy, defineConstant, defineName, deleteCols,
deleteRows, dependents, deprecations, display, errorCells, explain, exportJSON, fillDown,
fillRight, find, formula, fromCSV, get, getFormat, getInput, getNote, getStyle, getValidation,
hiddenCols, hiddenRows, hideCols, hideRows, insertCols, insertRows, invalidCells, isProtected,
lint, merge, merges, names, notes, onChange, precedents, protect, protectedCells, recalc, redo,
redoList, removeName, renameName, replace, save, set, setCell, setFormat, setMany, setNote,
setStyle, setValidation, showCols, showRows, sort, stats, text, toCSV, undo, undoList, unmerge,
unprotect, value`.split(/,\s*/);
const BOOK = `addSheet, batch, copy, defineConstant, defineName, deleteSheet, deprecations, errorCells, get,
names, redo, redoList, removeName, removeSheet, renameName, renameSheet, save, sheet, sheetNames,
undo, undoList`.split(/,\s*/);
const methods = (o) => Object.keys(o).filter((k) => typeof o[k] === "function").sort();

// The checkpoint titles 41 to 80 as starter/FEATURES.md lists them.
const TITLES = [
  "number formats", "cell notes", "COUNTIF and AVERAGEIF", "INDEX and MATCH", "SUMPRODUCT", "data validation", "merged ranges",
  "sorting a range", "hidden rows and columns", "SUBTOTAL", "find and replace", "named constants", "workbook names",
  "deleting a sheet", "undo across a workbook", "save format version 3", "TEXT", "EDATE, EOMONTH and WEEKDAY", "NETWORKDAYS",
  "CHOOSE and SWITCH", "SUBSTITUTE, FIND and SEARCH", "LET", "decimal comma", "fill down and fill right", "change events",
  "batches with rollback", "formula limits", "copying across sheets", "CSV import options", "comparing two saves",
  "protected cells", "error audit", "lint", "performance budget for wide fan-out", "API v3 and deprecations",
  "undo history labels", "range export to JSON", "renaming names", "cell styles", "API index and final change log",
];
const entries = () => readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));

test("cp80h the index is exactly the stated one", () => {
  const ix = apiIndex();
  assert.deepEqual(Object.keys(ix), ["exports", "sheet", "workbook"]);
  assert.deepEqual(ix.exports, EXPORTS);
  assert.equal(SHEET.length, 69);
  assert.equal(BOOK.length, 21);
  assert.deepEqual(ix.sheet, SHEET);
  assert.deepEqual(ix.workbook, BOOK);
});

test("cp80h sorted by code units, no name twice", () => {
  const ix = apiIndex();
  for (const k of ["exports", "sheet", "workbook"]) {
    const list = ix[k];
    for (let i = 1; i < list.length; i++) assert.ok(list[i - 1] < list[i], `${k}: ${list[i - 1]} before ${list[i]}`);
  }
});

test("cp80h deprecated names stay in the index", () => {
  const ix = apiIndex();
  for (const n of ["set", "get", "display", "cells", "getInput"]) assert.ok(ix.sheet.includes(n), n);
  assert.ok(ix.workbook.includes("sheet"));
  assert.ok(ix.sheet.includes("deprecations") && ix.workbook.includes("deprecations"));
});

test("cp80h the package exports exactly the listed names", () => {
  assert.deepEqual(Object.keys(pkg).sort(), EXPORTS);
  for (const n of EXPORTS) assert.equal(typeof pkg[n], "function", n);
});

test("cp80h every kind of sheet has exactly the listed methods", () => {
  const b = createWorkbook();
  const added = b.addSheet("Main");
  added.setCell("A1", "1");
  const loadedBook = loadWorkbook(b.save());
  const removed = b.addSheet("Gone");
  b.removeSheet("Gone");
  const sheets = { created: createSheet(), loaded: loadSheet(added.save()), added, fromBook: loadedBook.get("Main"), removed, comma: createSheet({ decimal: ",", errorOrder: "first" }) };
  for (const [kind, s] of Object.entries(sheets)) assert.deepEqual(methods(s), SHEET, kind);
});

test("cp80h every kind of workbook has exactly the listed methods", () => {
  const b = createWorkbook();
  b.addSheet("Main");
  for (const [kind, x] of Object.entries({ created: b, loaded: loadWorkbook(b.save()), migrated: loadWorkbook(createSheet().save()), options: createWorkbook({ errorOrder: "first" }) })) {
    assert.deepEqual(methods(x), BOOK, kind);
  }
});

test("cp80h every call gives new arrays; changing them changes nothing", () => {
  const a = apiIndex();
  a.sheet.push("extra");
  a.exports.length = 0;
  a.workbook[0] = "x";
  a.more = 1;
  const b = apiIndex();
  assert.notEqual(a, b);
  assert.notEqual(a.sheet, b.sheet);
  assert.deepEqual(b.exports, EXPORTS);
  assert.deepEqual(b.sheet, SHEET);
  assert.deepEqual(b.workbook, BOOK);
  assert.equal(b.more, undefined);
});

test("cp80h apiIndex changes nothing anywhere", () => {
  const b = createWorkbook();
  const s = b.addSheet("Main");
  const seen = [];
  s.onChange((e) => seen.push(e));
  s.set("A1", "1");
  b.sheet("Main");
  const before = [s.save(), JSON.stringify(s.undoList()), JSON.stringify(b.undoList()), JSON.stringify(s.deprecations()), JSON.stringify(b.deprecations()), s.stats().evaluations];
  apiIndex();
  apiIndex();
  assert.deepEqual([s.save(), JSON.stringify(s.undoList()), JSON.stringify(b.undoList()), JSON.stringify(s.deprecations()), JSON.stringify(b.deprecations()), s.stats().evaluations], before);
  assert.equal(seen.length, 1);
});

test("cp80h CHANGES.md holds exactly 80 entries, cp01 to cp80", () => {
  const lines = entries();
  assert.equal(lines.length, 80);
  lines.forEach((l, i) => assert.ok(l.startsWith(`- cp${String(i + 1).padStart(2, "0")}: `), l));
  assert.match(lines[79], /^- cp80: \S/);
});

test("cp80h no entry from cp41 on is only its title, and none repeats", () => {
  const texts = entries().map((l) => l.replace(/^- cp\d\d: /, ""));
  TITLES.forEach((t, i) => assert.notEqual(texts[40 + i].toLowerCase(), t.toLowerCase(), `cp${41 + i}`));
  assert.equal(new Set(texts.map((t) => t.toLowerCase())).size, 80);
  for (const t of texts) assert.ok(t.length >= 1 && t.length <= 120 && t === t.trim(), t);
});
