// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkbook, loadWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
const err = (v) => (v && typeof v === "object" ? `${v.code}@${v.cell}` : v);

test("cp37h errors, in order, change nothing", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.set("A1", "5");
  m.set("A1", "=Data!A1");
  assert.throws(() => b.renameSheet("Nope", "X"), thrown("#SHEET", "Nope"));
  assert.throws(() => b.renameSheet(null, "X"), thrown("#SHEET", "null"));
  assert.throws(() => b.renameSheet("Nope", "1bad"), thrown("#SHEET", "Nope"));
  assert.throws(() => b.renameSheet("Nope", "main"), thrown("#SHEET", "Nope"));
  assert.throws(() => b.renameSheet("Data", "A1"), thrown("#BADNAME", "A1"));
  assert.throws(() => b.renameSheet("Data", ""), thrown("#BADNAME", ""));
  assert.throws(() => b.renameSheet("Data", null), thrown("#BADNAME", "null"));
  assert.throws(() => b.renameSheet("data", "bad name"), thrown("#BADNAME", "bad name"));
  assert.throws(() => b.renameSheet("Data", "MAIN"), thrown("#SHEET", "MAIN"));
  assert.deepEqual(b.sheetNames(), ["Main", "Data"]);
  assert.equal(m.getInput("A1"), "=Data!A1");
  assert.equal(m.get("A1"), 5);
  assert.equal(m.undo(), true);
  assert.equal(m.getInput("A1"), null);
  assert.equal(m.redo(), true);
  assert.equal(m.getInput("A1"), "=Data!A1");
});

test("cp37h prefixes rewritten everywhere, nothing else touched", () => {
  const b = createWorkbook();
  const a = b.addSheet("A");
  const d = b.addSheet("Data");
  b.addSheet("C");
  a.defineName("DATA", "B1:B2");
  a.set("B1", "1");
  a.set("B2", "2");
  d.set("A1", "10");
  d.set("A2", "=data!A1*2 + DATA!A1");
  a.set("A1", "=SUM(DATA)+Data!A1+data!A1");
  a.set("A2", "=Data!A1:A2");
  a.set("A3", "=IF(TRUE, DATA!A1, 0)");
  a.set("A4", "=Data!$A$1*2");
  a.set("A5", "=sum( data!A1 , 1 )");
  a.set("A6", "Data!A1");
  a.set("A7", "=Data!A1+");
  a.set("A8", '="Data!A1"&Data!A1');
  a.set("A9", "=SUM(Data!A1:data!A2)");
  a.set("B3", "'=Data!A1");
  assert.equal(a.get("A1"), 23);
  assert.equal(err(a.get("A7")), "#PARSE!@A7");
  b.renameSheet("DATA", "Facts");
  assert.deepEqual(b.sheetNames(), ["A", "Facts", "C"]);
  const inputs = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "B3"].map((k) => a.getInput(k));
  assert.deepEqual(inputs, [
    "=SUM(DATA)+Facts!A1+Facts!A1",
    "=Facts!A1:A2",
    "=IF(TRUE, Facts!A1, 0)",
    "=Facts!$A$1*2",
    "=sum( Facts!A1 , 1 )",
    "Data!A1",
    "=Data!A1+",
    '="Data!A1"&Facts!A1',
    "=SUM(Data!A1:data!A2)",
    "'=Data!A1",
  ]);
  assert.equal(d.getInput("A2"), "=Facts!A1*2 + Facts!A1");
  assert.deepEqual(a.names(), { DATA: "B1:B2" });
  assert.equal(a.get("A1"), 23);
  assert.equal(a.get("A4"), 20);
  assert.equal(a.get("A5"), 11);
  assert.equal(a.get("A8"), "Data!A110");
  assert.equal(d.get("A2"), 30);
  assert.equal(err(a.get("A7")), "#PARSE!@A7");
});

test("cp37h new name starts resolving, old name stops", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Old");
  d.set("A1", "7");
  m.set("A1", "=New!A1");
  m.set("A2", "=Old!A1");
  assert.equal(err(m.get("A1")), "#REF!@A1");
  assert.equal(m.get("A2"), 7);
  b.renameSheet("old", "New");
  assert.equal(b.sheet("NEW"), d);
  assert.throws(() => b.sheet("Old"), thrown("#SHEET", "Old"));
  assert.equal(m.get("A1"), 7);
  assert.equal(m.get("A2"), 7);
  assert.equal(m.getInput("A2"), "=New!A1");
  m.set("A3", "=Old!A1");
  assert.equal(err(m.get("A3")), "#REF!@A3");
  b.addSheet("old").set("A1", "8");
  assert.equal(m.get("A3"), 8);
  assert.equal(m.get("A2"), 7);
  d.set("A1", "9");
  assert.equal(m.get("A1"), 9);
  assert.equal(m.get("A2"), 9);
  assert.deepEqual(m.precedents("A2"), ["New!A1"]);
  assert.deepEqual(d.dependents("A1"), ["Main!A1", "Main!A2"]);
  assert.equal(b.save(), '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[{"name":"Main","cells":{"A1":"=New!A1","A2":"=New!A1","A3":"=Old!A1"},"names":{}},{"name":"New","cells":{"A1":"9"},"names":{}},{"name":"old","cells":{"A1":"8"},"names":{}}]}');
});

test("cp37h undo cleared on every sheet; same name is a no-op; case-only rename", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  const x = b.addSheet("X");
  m.set("A1", "1");
  m.set("A1", "2");
  m.undo();
  d.set("A1", "3");
  x.set("A1", "4");
  assert.equal(b.renameSheet("Data", "Data"), undefined);
  assert.equal(m.redo(), true);
  assert.equal(m.getInput("A1"), "2");
  assert.equal(d.undo(), true);
  assert.equal(d.getInput("A1"), null);
  m.set("A1", "=data!A1");
  d.set("A1", "5");
  x.set("B1", "1");
  x.undo();
  b.renameSheet("data", "DATA");
  assert.equal(m.undo(), false);
  assert.equal(d.undo(), false);
  assert.equal(x.redo(), false);
  assert.equal(x.undo(), false);
  assert.equal(m.getInput("A1"), "=DATA!A1");
  assert.equal(m.get("A1"), 5);
  assert.deepEqual(b.sheetNames(), ["Main", "DATA", "X"]);
  m.set("A2", "6");
  assert.equal(m.undo(), true);
  assert.equal(m.getInput("A2"), null);
  assert.equal(m.redo(), true);
  assert.equal(m.getInput("A2"), "6");
});

test("cp37h removed sheet untouched; renamed book saves and loads", () => {
  const b = createWorkbook();
  const g = b.addSheet("Gone");
  const s = b.addSheet("Src");
  g.set("A1", "=Src!A1");
  s.set("A1", "3");
  s.set("A2", "=src!A1*2");
  b.removeSheet("gone");
  b.renameSheet("Src", "Dst");
  assert.equal(g.getInput("A1"), "=Src!A1");
  assert.equal(s.getInput("A2"), "=Dst!A1*2");
  assert.equal(s.get("A2"), 6);
  const text = b.save();
  assert.equal(text, '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[{"name":"Dst","cells":{"A1":"3","A2":"=Dst!A1*2"},"names":{}}]}');
  assert.equal(loadWorkbook(text).sheet("dst").get("A2"), 6);
});
