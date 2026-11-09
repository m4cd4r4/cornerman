// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
const err = (v) => (v && typeof v === "object" ? `${v.code}@${v.cell}` : v);
function book() {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  const x = b.addSheet("Extra");
  d.fromCSV("1\n2\n3", "A1");
  return { b, m, d, x };
}

test("cp54h references to the deleted sheet become #REF!, nothing else changes", () => {
  const { b, m, x } = book();
  const inputs = {
    A1: "=SUM(Data!A1:A3, B1) + data!C1",
    A2: '="Data!A1"&Data!$A$1',
    A3: "Data!A1",
    A4: "=Data!A1+",
    A5: "=Other!A1+DATA!B2:C3*Extra!A1",
    A6: "=sum( data!a1:a2 )",
    A7: "=DATAX!A1+Dat!A1",
    A8: "=IF(TRUE,Data!A1,Data!B1:B2)",
    A9: "=Data!A1:$B$2",
  };
  m.setMany(inputs);
  x.set("A1", "=Data!A2*2");
  x.set("A2", "=Main!A1");
  assert.equal(b.deleteSheet("dATA"), 7);
  assert.deepEqual(Object.keys(inputs).map((k) => m.getInput(k)), [
    "=SUM(#REF!, B1) + #REF!",
    '="Data!A1"&#REF!',
    "Data!A1",
    "=Data!A1+",
    "=Other!A1+#REF!*Extra!A1",
    "=sum( #REF! )",
    "=DATAX!A1+Dat!A1",
    "=IF(TRUE,#REF!,#REF!)",
    "=#REF!",
  ]);
  assert.equal(x.getInput("A1"), "=#REF!*2");
  assert.equal(x.getInput("A2"), "=Main!A1");
  assert.deepEqual(b.sheetNames(), ["Main", "Extra"]);
});

test("cp54h the values are what the new text gives", () => {
  const { b, m } = book();
  m.set("A1", "=Data!A1*2");
  m.set("A2", "=SUM(Data!A1:A3)");
  m.set("A3", "=IFERROR(Data!A1, 7)");
  m.set("A4", "=ISERROR(Data!A2)");
  m.set("A5", "=COUNT(Data!A1:A3)");
  m.set("A6", '=Data!A1&"x"');
  assert.equal(m.get("A2"), 6);
  b.deleteSheet("Data");
  assert.equal(err(m.get("A1")), "#REF!@A1");
  assert.equal(err(m.get("A2")), "#REF!@A2");
  assert.equal(m.get("A3"), 7);
  assert.equal(m.get("A4"), true);
  assert.equal(m.get("A5"), 0);
  assert.equal(err(m.get("A6")), "#REF!@A6");
  assert.deepEqual(m.precedents("A1"), []);
  assert.equal(m.canonical("A2"), "=SUM(#REF!)");
});

test("cp54h unlike removeSheet, a new sheet of that name is not read", () => {
  const { b, m } = book();
  m.set("A1", "=Data!A1");
  m.set("A2", "=Extra!A1");
  b.removeSheet("Extra");
  assert.equal(err(m.get("A2")), "#REF!@A2");
  b.addSheet("Extra").set("A1", "4");
  assert.equal(m.get("A2"), 4);
  b.deleteSheet("Data");
  const n = b.addSheet("Data");
  n.set("A1", "9");
  assert.equal(m.getInput("A1"), "=#REF!");
  assert.equal(err(m.get("A1")), "#REF!@A1");
  m.set("A3", "=Data!A1+1");
  assert.equal(m.get("A3"), 10);
  assert.deepEqual(b.sheetNames(), ["Main", "Extra", "Data"]);
});

test("cp54h the deleted sheet keeps working on its own", () => {
  const { b, m, d } = book();
  d.set("B1", "=Data!A1+A2");
  d.set("B2", "=Main!A1");
  d.defineName("TOP", "A1");
  d.setNote("A1", "first");
  d.merge("C1:C2");
  m.set("A1", "5");
  assert.equal(d.get("B1"), 3);
  assert.equal(b.deleteSheet("Data"), 0);
  assert.equal(d.getInput("B1"), "=Data!A1+A2");
  assert.equal(err(d.get("B1")), "#REF!@B1");
  assert.equal(err(d.get("B2")), "#REF!@B2");
  assert.equal(d.get("A2"), 2);
  assert.deepEqual(d.names(), { TOP: "A1" });
  assert.equal(d.getNote("A1"), "first");
  assert.deepEqual(d.merges(), ["C1:C2"]);
  assert.equal(d.undo(), false);
  assert.throws(() => b.sheet("Data"), thrown("#SHEET", "Data"));
  d.set("A3", "30");
  assert.equal(d.undo(), true);
});

test("cp54h workbook names on the deleted sheet are removed", () => {
  const { b, m, x } = book();
  b.defineName("ALL", "data!A1:A3");
  b.defineName("FIRST", "DATA!A1");
  b.defineName("HERE", "Main!B1");
  b.defineName("LATER", "Nope!A1");
  b.defineConstant("K", 2);
  m.set("A1", "=SUM(ALL)*K");
  m.set("A2", "=FIRST");
  x.set("A1", "=FIRST");
  x.defineConstant("FIRST", 100);
  assert.equal(m.get("A1"), 12);
  b.deleteSheet("Data");
  assert.deepEqual(b.names(), { HERE: "Main!B1", K: "=2", LATER: "Nope!A1" });
  assert.equal(err(m.get("A1")), "#NAME?@A1");
  assert.equal(err(m.get("A2")), "#NAME?@A2");
  assert.equal(x.get("A1"), 100);
  assert.equal(m.getInput("A1"), "=SUM(ALL)*K");
  b.addSheet("Data");
  assert.equal(err(m.get("A2")), "#NAME?@A2");
});

test("cp54h every undo list is cleared", () => {
  const { b, m, d, x } = book();
  m.set("A1", "1");
  m.set("A1", "2");
  m.undo();
  x.set("A1", "3");
  b.deleteSheet("Data");
  assert.equal(m.redo(), false);
  assert.equal(m.undo(), false);
  assert.equal(x.undo(), false);
  assert.equal(d.undo(), false);
  assert.equal(m.getInput("A1"), "1");
  m.set("B1", "x");
  assert.equal(m.undo(), true);
  assert.equal(m.getInput("B1"), null);
  assert.equal(m.undo(), false);
});

test("cp54h the last sheet may go; errors change nothing", () => {
  const b = createWorkbook();
  assert.throws(() => b.deleteSheet("Main"), thrown("#SHEET", "Main"));
  const m = b.addSheet("Main");
  m.set("A1", "=Main!B1");
  assert.throws(() => b.deleteSheet(null), thrown("#SHEET", "null"));
  assert.throws(() => b.deleteSheet("Mai"), thrown("#SHEET", "Mai"));
  assert.throws(() => b.deleteSheet(1), thrown("#SHEET", "1"));
  assert.deepEqual(b.sheetNames(), ["Main"]);
  assert.equal(b.deleteSheet("MAIN"), 0);
  assert.deepEqual(b.sheetNames(), []);
  assert.equal(m.getInput("A1"), "=Main!B1");
  assert.equal(b.save(), '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[]}');
  assert.equal(b.removeSheet("Main"), false);
});

test("cp54h layers of the other sheets are kept; the rewritten book saves", () => {
  const { b, m } = book();
  m.set("A1", "=Data!A1");
  m.set("A2", "4");
  m.setFormat("A2", "0.00");
  m.setNote("A1", "from data");
  m.hideRows(3);
  m.merge("B1:C1");
  b.deleteSheet("Data");
  assert.equal(m.display("A2"), "4.00");
  assert.equal(m.getNote("A1"), "from data");
  assert.deepEqual(m.hiddenRows(), [3]);
  assert.deepEqual(m.merges(), ["B1:C1"]);
  assert.equal(m.save(), '{"format":"sheet","version":1,"cells":{"A1":"=#REF!","A2":"4"},"names":{},"notes":{"A1":"from data"}}');
});

test("cp54h CHANGES.md has a cp54 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 54);
  assert.match(lines[53], /^- cp54: \S/);
  assert.notEqual(lines[53].slice(8).toLowerCase(), "deleting a sheet");
});
