// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook, loadSheet, loadWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;

test("cp42h text is trimmed; blank removes; 200 characters at most", () => {
  const s = createSheet();
  s.setNote("A1", "  padded\t\n");
  assert.equal(s.getNote("A1"), "padded");
  s.setNote("A1", "   ");
  assert.equal(s.getNote("A1"), null);
  s.setNote("A2", " " + "x".repeat(200) + "  ");
  assert.equal(s.getNote("A2"), "x".repeat(200));
  assert.throws(() => s.setNote("a3", "y".repeat(201)), thrown("#NOTE", "A3"));
  assert.throws(() => s.setNote("a3", 5), thrown("#NOTE", "A3"));
  assert.throws(() => s.setNote("A3", null), thrown("#NOTE", "A3"));
  assert.throws(() => s.setNote("A0", 5), thrown("#ADDR", "A0"));
  assert.throws(() => s.getNote("ZZZ1"), thrown("#ADDR", "ZZZ1"));
  assert.equal(s.getNote("A3"), null);
  s.setNote("A4", "inner  spaces  kept");
  assert.equal(s.getNote("A4"), "inner  spaces  kept");
});

test("cp42h notes() is row-major and notes are not cells", () => {
  const s = createSheet();
  s.setNote("B2", "b2");
  s.setNote("A3", "a3");
  s.setNote("C1", "c1");
  s.setNote("A1", "a1");
  assert.deepEqual(Object.keys(s.notes()), ["A1", "C1", "B2", "A3"]);
  s.set("D1", "=SUM(A1:C3)");
  assert.deepEqual(s.cells(), ["D1"]);
  assert.equal(s.get("D1"), 0);
  assert.equal(s.get("A1"), null);
  assert.equal(s.display("A1"), "");
  assert.equal(s.toCSV(), ",,,0");
  const o = s.notes();
  o.A1 = "changed";
  assert.equal(s.getNote("A1"), "a1");
});

test("cp42h set, clearing and fromCSV keep notes", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.setNote("A1", "keep me");
  s.set("A1", "");
  assert.equal(s.getNote("A1"), "keep me");
  s.fromCSV("5,6\n7,8", "A1");
  assert.equal(s.getNote("A1"), "keep me");
  assert.equal(s.get("A1"), 5);
  s.setMany({ A1: "9" });
  assert.equal(s.getNote("A1"), "keep me");
});

test("cp42h copy leaves notes where they are", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.setNote("A1", "source note");
  s.setNote("B5", "target note");
  s.copy("A1:B1", "A5");
  assert.equal(s.getNote("A5"), null);
  assert.equal(s.getNote("B5"), "target note");
  assert.equal(s.getNote("A1"), "source note");
  assert.equal(s.getInput("A5"), "1");
});

test("cp42h insert and delete move notes; pushed off the sheet is dropped", () => {
  const s = createSheet();
  s.setNote("A2", "two");
  s.setNote("C1", "c");
  s.setNote("A9999", "last row");
  s.set("A5", "5");
  s.insertRows(2, 1);
  assert.equal(s.getNote("A2"), null);
  assert.equal(s.getNote("A3"), "two");
  assert.equal(s.getNote("A9999"), null);
  assert.deepEqual(s.notes(), { C1: "c", A3: "two" });
  s.insertCols("A", 2);
  assert.deepEqual(s.notes(), { E1: "c", C3: "two" });
  s.deleteCols("C", 1);
  assert.deepEqual(s.notes(), { D1: "c" });
  s.undo();
  assert.deepEqual(s.notes(), { E1: "c", C3: "two" });
  s.undo();
  s.undo();
  assert.deepEqual(s.notes(), { C1: "c", A2: "two", A9999: "last row" });
  s.redo();
  assert.equal(s.getNote("A3"), "two");
  assert.throws(() => s.insertRows(2, 9994), thrown("#FULL", "2"));
  assert.equal(s.getNote("A3"), "two");
  s.deleteRows(2, 2);
  assert.deepEqual(s.notes(), { C1: "c" });
});

test("cp42h undo: one step per change, unchanged notes not recorded", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.setNote("A1", "first");
  s.setNote("A1", " first ");
  s.setNote("B1", "");
  s.setNote("A1", "second");
  assert.equal(s.undo(), true);
  assert.equal(s.getNote("A1"), "first");
  assert.equal(s.undo(), true);
  assert.equal(s.getNote("A1"), null);
  assert.equal(s.getInput("A1"), "1");
  s.setNote("C1", "");
  assert.equal(s.redo(), true);
  assert.equal(s.getNote("A1"), "first");
  assert.equal(s.redo(), true);
  assert.equal(s.getNote("A1"), "second");
  assert.equal(s.redo(), false);
});

test("cp42h save writes notes after names only when there are some", () => {
  const s = createSheet();
  s.set("B1", "2");
  s.defineName("X", "B1");
  assert.equal(s.save(), '{"format":"sheet","version":1,"cells":{"B1":"2"},"names":{"X":"B1"}}');
  s.setNote("C2", "c2");
  s.setNote("A2", "a2");
  s.setNote("D1", "d1");
  assert.equal(s.save(), '{"format":"sheet","version":1,"cells":{"B1":"2"},"names":{"X":"B1"},"notes":{"D1":"d1","A2":"a2","C2":"c2"}}');
  const t = loadSheet(s.save());
  assert.deepEqual(t.notes(), { D1: "d1", A2: "a2", C2: "c2" });
  assert.equal(t.save(), s.save());
  assert.equal(t.undo(), false);
  s.setNote("D1", "");
  s.setNote("A2", "");
  s.setNote("C2", "");
  assert.equal(s.save(), '{"format":"sheet","version":1,"cells":{"B1":"2"},"names":{"X":"B1"}}');
});

test("cp42h workbook save and load carry notes per sheet", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  m.set("A1", "=Data!A1");
  d.set("A1", "4");
  d.setNote("B2", "data note");
  const text = b.save();
  assert.equal(text, '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[{"name":"Main","cells":{"A1":"=Data!A1"},"names":{}},{"name":"Data","cells":{"A1":"4"},"names":{},"notes":{"B2":"data note"}}]}');
  const c = loadWorkbook(text);
  assert.deepEqual(c.sheet("Data").notes(), { B2: "data note" });
  assert.deepEqual(c.sheet("Main").notes(), {});
  assert.equal(c.save(), text);
  const v1 = createSheet();
  v1.setNote("A1", "old");
  assert.deepEqual(loadWorkbook(v1.save()).sheet("Sheet_1").notes(), { A1: "old" });
  b.renameSheet("Data", "Facts");
  assert.deepEqual(d.notes(), { B2: "data note" });
});

test("cp42h loading checks notes after names, in order", () => {
  const doc = (notes, extra = {}) => JSON.stringify({ format: "sheet", version: 1, cells: { A1: "1" }, names: {}, ...extra, notes });
  const fails = (text, cell) => assert.throws(() => loadSheet(text), thrown("#LOAD", cell), `${text}`);
  fails(doc([]), "notes");
  fails(doc(null), "notes");
  fails(doc("x"), "notes");
  fails(doc({ a1: "x" }), "a1");
  fails(doc({ A0: "x" }), "A0");
  fails(doc({ A1: " x" }), "A1");
  fails(doc({ A1: "x\n" }), "A1");
  fails(doc({ A1: "" }), "A1");
  fails(doc({ A1: 5 }), "A1");
  fails(doc({ A1: "z".repeat(201) }), "A1");
  fails(doc({ B1: "ok", a2: "x" }), "a2");
  fails(doc(5, { names: { "1x": "A1" } }), "1x");
  fails(doc(5, { cells: { a1: "1" } }), "a1");
  assert.deepEqual(loadSheet(doc({})).notes(), {});
  assert.deepEqual(loadSheet(doc({ B3: "z".repeat(200) })).notes(), { B3: "z".repeat(200) });
  const wb = (notes) => JSON.stringify({ format: "workbook", version: 2, errorOrder: "first", sheets: [{ name: "A", cells: {}, names: {} }, { name: "B", cells: {}, names: {}, notes }] });
  assert.throws(() => loadWorkbook(wb([])), thrown("#LOAD", "sheets.1.notes"));
  assert.throws(() => loadWorkbook(wb({ c1: "x" })), thrown("#LOAD", "sheets.1.notes.c1"));
  assert.throws(() => loadWorkbook(wb({ C1: "x " })), thrown("#LOAD", "sheets.1.notes.C1"));
  assert.deepEqual(loadWorkbook(wb({ C1: "x" })).sheet("B").notes(), { C1: "x" });
});

test("cp42h CHANGES.md has a cp42 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 42);
  assert.match(lines[41], /^- cp42: \S/);
  assert.notEqual(lines[41].slice(8).toLowerCase(), "cell notes");
});
