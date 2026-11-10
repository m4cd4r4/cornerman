// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook, diffWorkbooks } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
const cell = (sheet, c, before, after) => ({ kind: "cell", sheet, cell: c, before, after });
const name = (sheet, n, before, after) => ({ kind: "name", sheet, name: n, before, after });
function book() {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  m.setMany({ A1: "1", B1: "=A1", A2: "x" });
  d.setMany({ A1: "5" });
  return { b, m, d };
}

test("cp70h every kind of change, in the stated order", () => {
  const { b, m, d } = book();
  m.defineName("T", "A1:A2");
  b.defineConstant("K", 1);
  b.addSheet("Old");
  const s1 = b.save();
  b.removeSheet("Old");
  m.setMany({ B1: "=a1", A2: "", C3: "new", B2: "b" });
  d.set("A1", "6");
  m.defineName("T", "A1");
  m.defineConstant("U", "u");
  b.addSheet("Extra").set("A1", "e");
  b.addSheet("Added");
  b.defineConstant("K", 2);
  b.defineName("J", "Main!A1");
  assert.deepEqual(diffWorkbooks(s1, b.save()), [
    { kind: "sheet-removed", sheet: "Old" },
    { kind: "sheet-added", sheet: "Extra" },
    { kind: "sheet-added", sheet: "Added" },
    cell("Main", "B1", "=A1", "=a1"),
    cell("Main", "A2", "x", null),
    cell("Main", "B2", null, "b"),
    cell("Main", "C3", null, "new"),
    name("Main", "T", "A1:A2", "A1"),
    name("Main", "U", null, '="u"'),
    cell("Data", "A1", "5", "6"),
    name(null, "J", null, "Main!A1"),
    name(null, "K", "=1", "=2"),
  ]);
});

test("cp70h inputs are compared as typed", () => {
  const { b, m } = book();
  const s1 = b.save();
  m.setMany({ A1: "1.0", B1: "=a1", A2: "X" });
  assert.deepEqual(diffWorkbooks(s1, b.save()).map((c) => c.cell), ["A1", "B1", "A2"]);
  m.setMany({ A1: "=0+1", B1: "=A1", A2: "x" });
  assert.deepEqual(diffWorkbooks(s1, b.save()), [cell("Main", "A1", "1", "=0+1")]);
});

test("cp70h sheets are matched by name only", () => {
  const { b } = book();
  const s1 = b.save();
  b.renameSheet("Data", "DATA");
  assert.deepEqual(diffWorkbooks(s1, b.save()), []);
  b.renameSheet("DATA", "Facts");
  assert.deepEqual(diffWorkbooks(s1, b.save()), [{ kind: "sheet-removed", sheet: "Data" }, { kind: "sheet-added", sheet: "Facts" }]);
  const c = createWorkbook();
  c.addSheet("data").set("A1", "7");
  c.addSheet("MAIN").setMany({ A1: "1", B1: "=A1", A2: "x" });
  assert.deepEqual(diffWorkbooks(s1, c.save()), [cell("data", "A1", "5", "7")]);
  assert.deepEqual(diffWorkbooks(c.save(), s1), [cell("Data", "A1", "7", "5")]);
});

test("cp70h formats, notes, rules, merges, hiding and the error order are not compared", () => {
  const { b } = book();
  const s1 = b.save();
  const c = createWorkbook({ errorOrder: "first" });
  const m = c.addSheet("Main");
  m.setMany({ A1: "1", B1: "=A1", A2: "x" });
  c.addSheet("Data").set("A1", "5");
  m.setFormat("A1", "0.00");
  m.setNote("A2", "note");
  m.setValidation("B1", { type: "whole", min: 1, max: 2 });
  m.merge("C1:D1");
  m.hideRows(2);
  m.hideCols("B");
  const s2 = c.save();
  assert.match(s2, /"version":3/);
  assert.deepEqual(diffWorkbooks(s1, s2), []);
  assert.deepEqual(diffWorkbooks(s2, s1), []);
});

test("cp70h a version 1 sheet save is the sheet Sheet_1", () => {
  const s = createSheet();
  s.setMany({ A1: "1", B2: "=A1" });
  s.defineName("N", "A1");
  const c = createWorkbook();
  const t = c.addSheet("SHEET_1");
  t.setMany({ A1: "1", B2: "=A1*2" });
  assert.deepEqual(diffWorkbooks(s.save(), c.save()), [cell("SHEET_1", "B2", "=A1", "=A1*2"), name("SHEET_1", "N", "A1", null)]);
  assert.deepEqual(diffWorkbooks(s.save(), s.save()), []);
  const e = createWorkbook();
  e.addSheet("Other");
  assert.deepEqual(diffWorkbooks(s.save(), e.save()), [{ kind: "sheet-removed", sheet: "Sheet_1" }, { kind: "sheet-added", sheet: "Other" }]);
});

test("cp70h names sort by name and constants are written as names() writes them", () => {
  const { b, m } = book();
  const s1 = b.save();
  for (const n of ["Z", "A_B", "AB", "Q"]) m.defineConstant(n, n === "Q" ? 0.5 : true);
  b.defineName("b_2", "data!a1:b2");
  b.defineConstant("A", 'say "x"');
  assert.deepEqual(diffWorkbooks(s1, b.save()), [
    name("Main", "AB", null, "=TRUE"),
    name("Main", "A_B", null, "=TRUE"),
    name("Main", "Q", null, "=0.5"),
    name("Main", "Z", null, "=TRUE"),
    name(null, "A", null, '="say ""x"""'),
    name(null, "B_2", null, "data!A1:B2"),
  ]);
});

test("cp70h load errors name the side, before first", () => {
  const { b } = book();
  const ok = b.save();
  const badSheet = '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[{"name":"1x","cells":{},"names":{}}]}';
  for (const [x, y, c] of [
    [ok, "{x", "after"],
    ["{x", "{y", "before"],
    [null, ok, "before"],
    [ok, 5, "after"],
    [badSheet, ok, "before.sheets.0.name"],
    [ok, badSheet, "after.sheets.0.name"],
    ['{"format":"sheet","version":1,"cells":{"a1":"1"},"names":{}}', ok, "before.a1"],
    [ok, '{"format":"workbook","version":4}', "after.version"],
    [ok, '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[],"names":{"k":"=1"}}', "after.names.k"],
  ]) {
    assert.throws(() => diffWorkbooks(x, y), thrown("#LOAD", c), c);
  }
});

test("cp70h row-major cells, after's sheet order, sheets with no cells", () => {
  const b = createWorkbook();
  const p = b.addSheet("P");
  const q = b.addSheet("Q");
  const s1 = b.save();
  q.setMany({ B1: "1", A2: "2", AA1: "3" });
  p.set("C9", "9");
  const c = createWorkbook();
  c.addSheet("Q").setMany({ B1: "1", A2: "2", AA1: "3" });
  c.addSheet("P").set("C9", "9");
  assert.deepEqual(diffWorkbooks(s1, b.save()).map((x) => `${x.sheet}!${x.cell}`), ["P!C9", "Q!B1", "Q!AA1", "Q!A2"]);
  assert.deepEqual(diffWorkbooks(s1, c.save()).map((x) => `${x.sheet}!${x.cell}`), ["Q!B1", "Q!AA1", "Q!A2", "P!C9"]);
  assert.deepEqual(diffWorkbooks(b.save(), c.save()), []);
});

test("cp70h a sheet on one side lists no cells or names; formula errors do not matter", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  m.set("A1", "=A1");
  m.defineName("N", "A1");
  const s1 = b.save();
  const x = b.addSheet("X");
  x.set("A1", "=1/0");
  x.defineName("M", "B2");
  m.set("A2", "=1/0");
  assert.deepEqual(diffWorkbooks(s1, b.save()), [{ kind: "sheet-added", sheet: "X" }, cell("Main", "A2", null, "=1/0")]);
  assert.deepEqual(diffWorkbooks(b.save(), s1), [{ kind: "sheet-removed", sheet: "X" }, cell("Main", "A2", "=1/0", null)]);
});

test("cp70h CHANGES.md has a cp70 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 70);
  assert.match(lines[69], /^- cp70: \S/);
  assert.notEqual(lines[69].slice(8).toLowerCase(), "comparing two saves");
});
