// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook, loadSheet } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;

test("cp79h styles merge: given keys replace, null removes, others stay", () => {
  const s = createSheet();
  s.setStyle("A1", { fill: "#00aa00", bold: true });
  s.setStyle("A1", { color: "#FF0000" });
  assert.deepEqual(s.getStyle("A1"), { bold: true, color: "#FF0000", fill: "#00AA00" });
  assert.deepEqual(Object.keys(s.getStyle("A1")), ["bold", "color", "fill"]);
  s.setStyle("a1", { bold: null, italic: false, color: "#0000ff" });
  assert.deepEqual(s.getStyle("A1"), { italic: false, color: "#0000FF", fill: "#00AA00" });
  s.setStyle("A1", { italic: null, color: null, fill: null });
  assert.equal(s.getStyle("A1"), null);
  s.setStyle("A1:B2", { bold: false });
  assert.deepEqual(s.getStyle("B2"), { bold: false });
  const got = s.getStyle("B2");
  got.bold = true;
  got.fill = "#000000";
  assert.deepEqual(s.getStyle("B2"), { bold: false });
});

test("cp79h errors: target first, then the style, each key in order; nothing changes", () => {
  const s = createSheet();
  s.setStyle("A1", { bold: true });
  for (const [t, st, code, cell] of [
    ["A0", "x", "#ADDR", "A0"], [null, null, "#ADDR", "null"], ["A1:B5001", [], "#ARG", "A1:B5001"],
    ["A1", [], "#ARG", ""], ["A1", "bold", "#ARG", "bold"], ["A1", 5, "#ARG", "5"], ["A1", undefined, "#ARG", "undefined"],
    ["A1:B2", { bold: "yes" }, "#ARG", "bold"], ["A1", { italic: 1 }, "#ARG", "italic"], ["A1", { color: "red" }, "#ARG", "color"],
    ["A1", { color: "#FFF" }, "#ARG", "color"], ["A1", { fill: "#GGGGGG" }, "#ARG", "fill"], ["A1", { fill: "FF0000" }, "#ARG", "fill"],
    ["A1", { color: "#FF0000", size: 12 }, "#ARG", "size"], ["A1", { fill: 0, Bold: true }, "#ARG", "fill"], ["A1", { Bold: true, fill: 0 }, "#ARG", "Bold"],
    ["A1", { underline: true }, "#ARG", "underline"], ["A1", { color: "#FF00001" }, "#ARG", "color"],
  ]) {
    assert.throws(() => s.setStyle(t, st), thrown(code, cell), `${t} ${JSON.stringify(st)}`);
  }
  assert.deepEqual(s.getStyle("A1"), { bold: true });
  assert.equal(s.getStyle("B2"), null);
  assert.deepEqual(s.undoList(), ["setStyle"]);
  for (const bad of ["A0", null]) assert.throws(() => s.getStyle(bad), thrown("#ADDR", bad));
});

test("cp79h one undo step per call, none when nothing changes", () => {
  const s = createSheet();
  s.setStyle("A1:A3", { bold: true });
  s.setStyle("A1:A3", { bold: true });
  s.setStyle("A1:A3", {});
  s.setStyle("C1", null);
  assert.deepEqual(s.undoList(), ["setStyle"]);
  s.setStyle("A2:A4", { italic: true });
  assert.deepEqual(s.getStyle("A4"), { italic: true });
  assert.equal(s.undo(), true);
  assert.deepEqual(s.getStyle("A2"), { bold: true });
  assert.equal(s.getStyle("A4"), null);
  assert.equal(s.undo(), true);
  assert.equal(s.getStyle("A1"), null);
  assert.equal(s.redo(), true);
  assert.deepEqual(s.getStyle("A3"), { bold: true });
});

test("cp79h copy pastes whole styles, replacing, also from empty cells", () => {
  const s = createSheet();
  s.setMany({ A1: "1", B1: "2" });
  s.setStyle("A1", { bold: true });
  s.setStyle("C1:E1", { italic: true, fill: "#111111" });
  s.copy("A1:C1", "C1");
  assert.deepEqual(s.getStyle("C1"), { bold: true });
  assert.equal(s.getStyle("D1"), null);
  assert.deepEqual(s.getStyle("E1"), { italic: true, fill: "#111111" });
  assert.deepEqual(s.undoList(), ["copy", "setStyle", "setStyle", "setMany"]);
  s.undo();
  assert.deepEqual(s.getStyle("C1"), { italic: true, fill: "#111111" });
  assert.deepEqual(s.getStyle("D1"), { italic: true, fill: "#111111" });
  assert.equal(s.formula("C1"), "");
  s.redo();
  assert.equal(s.formula("C1"), "1");
  assert.equal(s.formula("D1"), "2");
  s.setStyle("A2", { color: "#ABCDEF" });
  s.copy("A1:A2", "A2");
  assert.deepEqual(s.getStyle("A2"), { bold: true });
  assert.deepEqual(s.getStyle("A3"), { color: "#ABCDEF" });
  s.setStyle("A5", { fill: "#123456" });
  s.setStyle("C6", { bold: true });
  s.copy("A5:A6", "C5");
  assert.deepEqual(s.getStyle("C5"), { fill: "#123456" });
  assert.equal(s.getStyle("C6"), null);
  assert.deepEqual(s.undoList()[0], "copy");
});

test("cp79h fills give each written cell its line's first style, as formats", () => {
  const s = createSheet();
  s.setMany({ A1: "=1+1", B1: "1", B2: "2", C1: "x" });
  s.setStyle("A1", { bold: true });
  s.setStyle("B1", { italic: true });
  s.setStyle("B2", { color: "#222222" });
  s.setStyle("A3", { fill: "#333333" });
  s.fillDown("A1:B4");
  assert.deepEqual(s.getStyle("A3"), { bold: true });
  assert.deepEqual(s.getStyle("A4"), { bold: true });
  assert.deepEqual(s.getStyle("B2"), { color: "#222222" });
  assert.deepEqual(s.getStyle("B3"), { italic: true });
  assert.equal(s.formula("B4"), "4");
  s.undo();
  assert.deepEqual(s.getStyle("A3"), { fill: "#333333" });
  s.fillRight("A1:C1");
  assert.deepEqual(s.getStyle("B1"), { bold: true });
  assert.deepEqual(s.getStyle("C1"), { bold: true });
  assert.equal(s.formula("C1"), "=1+1");
});

test("cp79h book.copy carries styles to the other sheet", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  m.setMany({ A1: "1", A2: "=A1" });
  m.setStyle("A2", { bold: true });
  d.setStyle("B1:B2", { italic: true });
  b.copy("Main!A1:A2", "Data!B1");
  assert.equal(d.getStyle("B1"), null);
  assert.deepEqual(d.getStyle("B2"), { bold: true });
  assert.equal(d.formula("B2"), "=Main!B1");
  d.undo();
  assert.deepEqual(d.getStyle("B1"), { italic: true });
  b.copy("Main!A2", "Main!C5");
  assert.deepEqual(m.getStyle("C5"), { bold: true });
});

test("cp79h sort moves inputs and formats but leaves styles", () => {
  const s = createSheet();
  s.setMany({ A1: "3", A2: "1", A3: "2" });
  s.setFormat("A1", "0.00");
  s.setStyle("A1", { bold: true });
  s.setStyle("A3", { color: "#FF0000" });
  s.sort("A1:A3", "A");
  assert.deepEqual([s.formula("A1"), s.formula("A2"), s.formula("A3")], ["1", "2", "3"]);
  assert.equal(s.getFormat("A3"), "0.00");
  assert.deepEqual(s.getStyle("A1"), { bold: true });
  assert.deepEqual(s.getStyle("A3"), { color: "#FF0000" });
  assert.equal(s.getStyle("A2"), null);
});

test("cp79h insert and delete move styles; inserted lines have none; undo puts them back", () => {
  const s = createSheet();
  s.setStyle("A1:B2", { bold: true });
  s.insertRows(2);
  assert.deepEqual(s.getStyle("A1"), { bold: true });
  assert.equal(s.getStyle("A2"), null);
  assert.deepEqual(s.getStyle("B3"), { bold: true });
  s.insertCols("B");
  assert.equal(s.getStyle("B1"), null);
  assert.deepEqual(s.getStyle("C3"), { bold: true });
  s.deleteRows(1);
  assert.equal(s.getStyle("A1"), null);
  assert.deepEqual(s.getStyle("A2"), { bold: true });
  s.undo();
  s.undo();
  s.undo();
  assert.deepEqual(s.getStyle("A2"), { bold: true });
  assert.deepEqual(s.getStyle("B2"), { bold: true });
  assert.equal(s.getStyle("A3"), null);
});

test("cp79h styles are not values: no effect on reads, events, clear, replace; any cell can be styled", () => {
  const s = createSheet();
  s.setMany({ A1: "1.5", B1: "x", C1: "y" });
  s.protect("A1");
  s.merge("B1:C1");
  const seen = [];
  s.onChange((e) => seen.push(e));
  const before = [s.text("A1"), s.toCSV(), s.exportJSON("A1:C1", { formats: true })];
  s.setStyle("A1:C1", { bold: true, fill: "#FFFFFF" });
  assert.deepEqual([s.text("A1"), s.toCSV(), s.exportJSON("A1:C1", { formats: true })], before);
  assert.deepEqual(seen, []);
  assert.deepEqual(s.getStyle("C1"), { bold: true, fill: "#FFFFFF" });
  s.unprotect("A1");
  s.replace("1.5", "2");
  s.clear("A1:C1");
  s.setCell("A1", "9");
  assert.deepEqual(s.getStyle("A1"), { bold: true, fill: "#FFFFFF" });
  assert.deepEqual(s.getStyle("B1"), { bold: true, fill: "#FFFFFF" });
});

test("cp79h styles are not saved; a rollback puts them back", () => {
  const s = createSheet();
  s.setCell("A1", "1");
  const plain = s.save();
  s.setStyle("A1:B2", { bold: true });
  assert.equal(s.save(), plain);
  assert.equal(loadSheet(s.save()).getStyle("A1"), null);
  const b = createWorkbook();
  const m = b.addSheet("Main");
  m.setStyle("A1", { italic: true });
  assert.equal(b.save(), '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[{"name":"Main","cells":{},"names":{}}]}');
  assert.throws(() => b.batch(() => { m.setStyle("A1", { color: "#123456" }); m.setStyle("B1", { bold: true }); throw new Error("x"); }), /x/);
  assert.deepEqual(m.getStyle("A1"), { italic: true });
  assert.equal(m.getStyle("B1"), null);
});

test("cp79h CHANGES.md has a cp79 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 79);
  assert.match(lines[78], /^- cp79: \S/);
  assert.notEqual(lines[78].slice(8).toLowerCase(), "cell styles");
});
