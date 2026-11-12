// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet, loadSheet, createWorkbook, loadWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
const err = (v) => (v && typeof v === "object" ? `${v.code}@${v.cell}` : v);
const book2 = (order, sheets) => JSON.stringify({ format: "workbook", version: 2, errorOrder: order, sheets });

test("cp35h save text", () => {
  assert.equal(createWorkbook().save(), '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[]}');
  const b = createWorkbook({ errorOrder: "first" });
  const m = b.addSheet("Main");
  const d = b.addSheet("data");
  const gone = b.addSheet("Gone");
  gone.set("A1", "1");
  m.set("A2", "=Later!A1");
  m.set("A1", "=data!A1*2");
  d.set("B1", "=SUM(RATE)");
  d.set("A1", "5");
  d.defineName("rate", "B1:B2");
  b.removeSheet("gone");
  const before = d.stats().evaluations;
  const text = b.save();
  assert.equal(text, '{"format":"workbook","version":2,"errorOrder":"first","sheets":[{"name":"Main","cells":{"A1":"=data!A1*2","A2":"=Later!A1"},"names":{}},{"name":"data","cells":{"A1":"5","B1":"=SUM(RATE)"},"names":{"RATE":"B1:B2"}}]}');
  assert.equal(d.stats().evaluations, before);
  assert.equal(d.undo(), true);
  assert.equal(b.save(), text.replace(',"names":{"RATE":"B1:B2"}', ',"names":{}'));
  assert.equal(m.save(), '{"format":"sheet","version":1,"cells":{"A1":"=data!A1*2","A2":"=Later!A1"},"names":{}}');
});

test("cp35h load round trip, values, independence", () => {
  const b = createWorkbook({ errorOrder: "first" });
  const m = b.addSheet("Main");
  const d = b.addSheet("data");
  m.set("A1", "=data!A1*2");
  m.set("A2", "=Later!A1");
  m.set("A3", "=1/0");
  m.set("A4", "=nope");
  m.set("A5", "=A3+A4");
  d.set("A1", "5");
  d.defineName("RATE", "B1:B2");
  d.set("B1", "=SUM(RATE)");
  const text = b.save();
  const l = loadWorkbook(text);
  assert.deepEqual(l.sheetNames(), ["Main", "data"]);
  assert.equal(l.save(), text);
  const lm = l.sheet("main");
  assert.equal(lm.stats().evaluations, 0);
  assert.equal(lm.get("A1"), 10);
  assert.equal(err(lm.get("A2")), "#REF!@A2");
  assert.equal(err(lm.get("A5")), "#DIV/0!@A3");
  assert.equal(err(l.sheet("DATA").get("B1")), "#CYCLE!@B1");
  assert.equal(lm.undo(), false);
  assert.equal(l.sheet("data").redo(), false);
  l.addSheet("Later").set("A1", "9");
  assert.equal(lm.get("A2"), 9);
  l.sheet("data").set("A1", "6");
  assert.equal(lm.get("A1"), 12);
  assert.equal(m.get("A1"), 10);
  assert.equal(b.save(), text);
  const fw = loadWorkbook(book2("priority", [{ name: "A_", cells: { A1: "=B_!A1+1" }, names: {} }, { name: "B_", cells: { A1: "41" }, names: {} }]));
  assert.equal(fw.sheet("A_").get("A1"), 42);
  const spaced = '\n { "sheets" : [ { "names":{}, "x":1, "cells":{"B2":"1","A1":"2"}, "name":"S" } ], "errorOrder":"priority", "version":2, "format":"workbook", "y":[] }\n';
  assert.equal(loadWorkbook(spaced).save(), book2("priority", [{ name: "S", cells: { A1: "2", B2: "1" }, names: {} }]));
});

test("cp35h migration from a version 1 sheet save", () => {
  const s = createSheet({ errorOrder: "first" });
  s.set("A1", "3");
  s.set("A2", "=Sheet_1!A1+A1");
  s.set("A3", "=1/0");
  s.set("A4", "=A3+nope");
  s.defineName("X", "A1");
  const v1 = s.save();
  assert.equal(err(s.get("A2")), "#REF!@A2");
  const mg = loadWorkbook(v1);
  assert.deepEqual(mg.sheetNames(), ["Sheet_1"]);
  const one = mg.sheet("sheet_1");
  assert.equal(one.get("A2"), 6);
  assert.equal(err(one.get("A4")), "#NAME?@A4");
  assert.equal(one.save(), v1);
  assert.equal(mg.save(), '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[{"name":"Sheet_1","cells":{"A1":"3","A2":"=Sheet_1!A1+A1","A3":"=1/0","A4":"=A3+nope"},"names":{"X":"A1"}}]}');
  one.set("A1", "4");
  assert.equal(s.get("A1"), 3);
  assert.equal(s.save(), v1);
  assert.equal(loadWorkbook(createSheet().save()).save(), '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[{"name":"Sheet_1","cells":{},"names":{}}]}');
  assert.throws(() => loadSheet(mg.save()), thrown("#LOAD", "format"));
});

test("cp35h load errors, in order", () => {
  const ok = { name: "A_", cells: {}, names: {} };
  const top = (o) => JSON.stringify({ format: "workbook", version: 2, errorOrder: "priority", sheets: [], ...o });
  const cases = [
    [42, ""], [undefined, ""], ["nope", ""], ["[]", ""], ["null", ""], ['"workbook"', ""],
    ['{"format":"x","version":"x"}', "format"], ['{"version":2}', "format"],
    ['{"format":"workbook","version":1,"errorOrder":"x"}', "version"], ['{"format":"workbook","version":"2"}', "version"],
    ['{"format":"workbook","version":2,"sheets":"x"}', "errorOrder"], [top({ errorOrder: "FIRST" }), "errorOrder"], [top({ errorOrder: null }), "errorOrder"],
    ['{"format":"workbook","version":2,"errorOrder":"first"}', "sheets"], [top({ sheets: {} }), "sheets"], [top({ sheets: "x" }), "sheets"],
    [top({ sheets: [null] }), "sheets.0"], [top({ sheets: [ok, []] }), "sheets.1"], [top({ sheets: [ok, "A_"] }), "sheets.1"],
    [top({ sheets: [{ cells: 1, names: 1 }] }), "sheets.0.name"], [top({ sheets: [{ name: "Sheet2", cells: {}, names: {} }] }), "sheets.0.name"],
    [top({ sheets: [{ name: "TRUE", cells: {}, names: {} }] }), "sheets.0.name"], [top({ sheets: [{ name: 7, cells: {}, names: {} }] }), "sheets.0.name"],
    [top({ sheets: [ok, { name: "B_", cells: {}, names: {} }, { name: "a_", cells: 1, names: 1 }] }), "sheets.2.name"],
    [top({ sheets: [{ name: "A_", names: 1 }] }), "sheets.0.cells"], [top({ sheets: [{ name: "A_", cells: [], names: {} }] }), "sheets.0.cells"],
    [top({ sheets: [{ name: "A_", cells: { a1: "1" } }] }), "sheets.0.names"], [top({ sheets: [{ name: "A_", cells: {}, names: [] }] }), "sheets.0.names"],
    [top({ sheets: [{ name: "A_", cells: { A1: "1", a2: "1", B1: "" }, names: { rate: "A1" } }] }), "sheets.0.cells.a2"],
    [top({ sheets: [{ name: "A_", cells: { A1: "" }, names: {} }] }), "sheets.0.cells.A1"], [top({ sheets: [{ name: "A_", cells: { A1: 1 }, names: {} }] }), "sheets.0.cells.A1"],
    [top({ sheets: [{ name: "A_", cells: { A1: "1" }, names: { rate: "A1" } }] }), "sheets.0.names.rate"],
    [top({ sheets: [{ name: "A_", cells: {}, names: { RATE: "B3:A1" } }] }), "sheets.0.names.RATE"],
    [top({ sheets: [{ name: "A_", cells: {}, names: { RATE: "a1" } }] }), "sheets.0.names.RATE"],
    [top({ sheets: [{ name: "A_", cells: {}, names: { RATE: "A1" } }, { name: "B_", cells: { ZZ: "1" }, names: {} }] }), "sheets.1.cells.ZZ"],
    ['{"format":"sheet","version":2,"cells":{},"names":{}}', "version"], ['{"format":"sheet","version":1,"names":{}}', "cells"],
    ['{"format":"sheet","version":1,"cells":{},"names":[]}', "names"], ['{"format":"sheet","version":1,"cells":{"b2":"1"},"names":{}}', "b2"],
    ['{"format":"sheet","version":1,"cells":{},"names":{"X":"b2"}}', "X"],
  ];
  for (const [text, cell] of cases) assert.throws(() => loadWorkbook(text), thrown("#LOAD", cell), String(text));
  assert.deepEqual(loadWorkbook(top({ extra: { sheets: 1 } })).sheetNames(), []);
});

test("cp35h recall: each sheet's names are written in the sorted order of checkpoint 30 and 14", () => {
  const b = createWorkbook();
  const s = b.addSheet("Main");
  s.defineName("A_B", "C1");
  s.defineName("AB", "C2");
  s.defineName("A1B", "C3");
  s.defineName("B", "C4");
  assert.deepEqual(Object.keys(JSON.parse(b.save()).sheets[0].names), ["A1B", "AB", "A_B", "B"]);
});
