// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook, loadWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
const err = (v) => (v && typeof v === "object" ? `${v.code}@${v.cell}` : v);
function book() {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.fromCSV("1\n2\n3", "A1");
  return { b, m, d };
}

test("cp53h names() writes the sheet as typed and the cells normalised", () => {
  const { b } = book();
  b.defineName("total", "data!b3:a1");
  b.defineName("First", "DATA!c2");
  b.defineName("one", "Data!A1:A1");
  b.defineConstant("rate", 0.5);
  b.defineConstant("LABEL", 'say "hi"');
  b.defineName("Later", "Nope!A1");
  assert.deepEqual(b.names(), { FIRST: "DATA!C2", LABEL: '="say ""hi"""', LATER: "Nope!A1", ONE: "Data!A1:A1", RATE: "=0.5", TOTAL: "data!A1:B3" });
  b.defineConstant("Total", 1);
  assert.equal(b.names().TOTAL, "=1");
  assert.equal(b.removeName("total"), true);
  assert.equal(b.removeName("TOTAL"), false);
  assert.equal(b.removeName(null), false);
  assert.equal(b.names().TOTAL, undefined);
});

test("cp53h defineName and defineConstant errors, in order, change nothing", () => {
  const { b } = book();
  b.defineName("K", "Data!A1");
  for (const [name, ref, code, cell] of [["A1", "Data!A1", "#BADNAME", "A1"], [null, "x", "#BADNAME", "null"], ["K", "A1:B3", "#ADDR", "A1:B3"], ["K", "1x!A1", "#ADDR", "1x!A1"], ["K", "Sheet2!A1", "#ADDR", "Sheet2!A1"], ["K", "Data!A0", "#ADDR", "Data!A0"], ["K", "Data !A1", "#ADDR", "Data !A1"], ["K", "Data!A1!B2", "#ADDR", "Data!A1!B2"], ["K", "Data!$A$1", "#ADDR", "Data!$A$1"], ["K", "Data!A1:B5001", "#ADDR", "Data!A1:B5001"], ["K", "=Data!A1", "#ADDR", "=Data!A1"], ["K", null, "#ADDR", "null"], ["K", "!A1", "#ADDR", "!A1"]]) {
    assert.throws(() => b.defineName(name, ref), thrown(code, cell), `${name} ${ref}`);
  }
  assert.throws(() => b.defineConstant("TRUE", 1), thrown("#BADNAME", "TRUE"));
  assert.throws(() => b.defineConstant("K", NaN), thrown("#ARG", "NaN"));
  assert.throws(() => b.defineConstant("K", {}), thrown("#ARG", "[object Object]"));
  assert.deepEqual(b.names(), { K: "Data!A1" });
});

test("cp53h a sheet's own names come first, even when they give an error", () => {
  const { b, m, d } = book();
  b.defineName("X", "Data!A1:A3");
  m.set("A1", "=SUM(X)");
  m.set("A2", "=X");
  assert.equal(m.get("A1"), 6);
  assert.equal(err(m.get("A2")), "#VALUE!@A2");
  m.defineName("x", "B1");
  m.set("B1", "100");
  assert.equal(m.get("A1"), 100);
  assert.equal(m.get("A2"), 100);
  m.defineName("X", "B1:B2");
  assert.equal(err(m.get("A2")), "#VALUE!@A2");
  m.defineConstant("X", 7);
  assert.equal(err(m.get("A1")), "#VALUE!@A1");
  assert.equal(m.get("A2"), 7);
  d.set("C1", "=X");
  assert.equal(err(d.get("C1")), "#VALUE!@C1");
  m.removeName("X");
  assert.equal(m.get("A1"), 6);
  b.removeName("X");
  assert.equal(err(m.get("A1")), "#NAME?@A1");
  assert.equal(err(d.get("C1")), "#NAME?@C1");
});

test("cp53h one-cell and range targets, values and constants", () => {
  const { b, m, d } = book();
  b.defineName("ONE", "Data!A2");
  b.defineName("CELLRANGE", "Data!A2:A2");
  b.defineConstant("K", "7");
  m.set("A1", "=ONE*10");
  m.set("A2", "=CELLRANGE");
  m.set("A3", "=SUM(CELLRANGE, ONE)");
  m.set("A4", "=K&ONE");
  m.set("A5", "=SUM(K)");
  m.set("A6", "=COUNTIF(Data!A1:A3, \">\"&ONE)");
  assert.equal(m.get("A1"), 20);
  assert.equal(err(m.get("A2")), "#VALUE!@A2");
  assert.equal(m.get("A3"), 4);
  assert.equal(m.get("A4"), "72");
  assert.equal(err(m.get("A5")), "#VALUE!@A5");
  assert.equal(m.get("A6"), 1);
  d.set("A2", "=1/0");
  assert.equal(err(m.get("A1")), "#DIV/0!@A2");
});

test("cp53h a target on a missing sheet is #REF! until the sheet is there", () => {
  const { b, m } = book();
  b.defineName("LATER", "Extra!B1:B2");
  b.defineName("CELL", "extra!B1");
  m.set("A1", "=SUM(LATER)");
  m.set("A2", "=CELL+1");
  m.set("A3", "=COUNT(LATER)");
  assert.equal(err(m.get("A1")), "#REF!@A1");
  assert.equal(err(m.get("A2")), "#REF!@A2");
  assert.equal(err(m.get("A3")), "#REF!@A3");
  const x = b.addSheet("EXTRA");
  x.set("B1", "5");
  x.set("B2", "6");
  assert.equal(m.get("A1"), 11);
  assert.equal(m.get("A2"), 6);
  assert.equal(m.get("A3"), 2);
  assert.deepEqual(m.precedents("A2"), ["EXTRA!B1"]);
  b.removeSheet("extra");
  assert.equal(err(m.get("A1")), "#REF!@A1");
  b.addSheet("Extra").set("B1", "1");
  assert.equal(m.get("A2"), 2);
});

test("cp53h row and column operations never move a workbook name", () => {
  const { b, m, d } = book();
  b.defineName("TOP", "Data!A1");
  b.defineName("ALL", "Data!A1:A3");
  m.set("A1", "=TOP");
  m.set("A2", "=SUM(ALL)");
  m.set("A3", "=Data!A1");
  d.insertRows(1);
  assert.equal(m.get("A1"), 0);
  assert.equal(m.get("A2"), 3);
  assert.equal(m.get("A3"), 0);
  d.deleteRows(1, 9);
  d.insertCols("A");
  assert.deepEqual(b.names(), { ALL: "Data!A1:A3", TOP: "Data!A1" });
  d.set("A1", "8");
  assert.equal(m.get("A1"), 8);
  m.insertRows(1);
  assert.equal(m.getInput("A2"), "=TOP");
  assert.deepEqual(b.names(), { ALL: "Data!A1:A3", TOP: "Data!A1" });
});

test("cp53h renameSheet rewrites workbook name targets", () => {
  const { b, m } = book();
  b.defineName("ALL", "data!A1:A3");
  b.defineName("OTHER", "Main!B1");
  b.defineName("GONE", "Old!A1");
  m.set("A1", "=SUM(ALL)");
  b.renameSheet("DATA", "Facts");
  assert.deepEqual(b.names(), { ALL: "Facts!A1:A3", GONE: "Old!A1", OTHER: "Main!B1" });
  assert.equal(m.get("A1"), 6);
  assert.deepEqual(m.precedents("A1"), ["Facts!A1", "Facts!A2", "Facts!A3"]);
  b.addSheet("Data").set("A1", "100");
  assert.equal(m.get("A1"), 6);
  b.renameSheet("Data", "Old");
  assert.deepEqual(b.names(), { ALL: "Facts!A1:A3", GONE: "Old!A1", OTHER: "Main!B1" });
  m.set("A2", "=GONE");
  assert.equal(m.get("A2"), 100);
});

test("cp53h precedents, dependents and recalculation", () => {
  const { b, m, d } = book();
  b.defineName("ALL", "Data!A1:A2");
  m.set("A1", "=SUM(ALL)");
  d.set("B1", "=SUM(ALL)");
  m.set("B1", "=1+1");
  assert.deepEqual(m.precedents("A1"), ["Data!A1", "Data!A2"]);
  assert.deepEqual(d.precedents("B1"), ["A1", "A2"]);
  assert.deepEqual(d.dependents("A1"), ["B1", "Main!A1"]);
  assert.equal(m.get("A1"), 3);
  m.get("B1");
  const before = m.stats().evaluations;
  d.set("A2", "10");
  assert.equal(m.get("A1"), 11);
  b.defineName("ALL", "Data!A1:A3");
  assert.equal(m.get("A1"), 14);
  assert.equal(d.get("B1"), 14);
  b.defineConstant("ALL", 1);
  assert.equal(err(m.get("A1")), "#VALUE!@A1");
  assert.deepEqual(m.precedents("A1"), []);
  m.get("B1");
  assert.equal(m.stats().evaluations, before + 3);
});

test("cp53h a removed sheet and a lone sheet see no workbook names", () => {
  const { b, m } = book();
  b.defineConstant("K", 3);
  m.set("A1", "=K");
  assert.equal(m.get("A1"), 3);
  b.removeSheet("Main");
  assert.equal(err(m.get("A1")), "#NAME?@A1");
  const s = createSheet();
  s.set("A1", "=K");
  assert.equal(err(s.get("A1")), "#NAME?@A1");
  const n = b.addSheet("Main");
  n.set("A1", "=K*2");
  assert.equal(n.get("A1"), 6);
});

test("cp53h workbook names are not on any sheet's undo list", () => {
  const { b, m, d } = book();
  m.set("A1", "=K");
  b.defineConstant("K", 1);
  m.set("A2", "x");
  m.undo();
  b.defineConstant("K", 2);
  assert.equal(m.redo(), true);
  assert.equal(m.undo(), true);
  assert.equal(m.undo(), true);
  assert.equal(m.getInput("A1"), null);
  assert.equal(m.undo(), false);
  assert.deepEqual(b.names(), { K: "=2" });
  assert.equal(d.undo(), true);
  assert.equal(d.undo(), false);
});

test("cp53h saved after the sheets, only when there are any", () => {
  const { b, m } = book();
  const plain = b.save();
  assert.equal(plain, '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[{"name":"Main","cells":{},"names":{}},{"name":"Data","cells":{"A1":"1","A2":"2","A3":"3"},"names":{}}]}');
  b.defineName("all", "data!a1:a3");
  b.defineConstant("K", true);
  m.set("A1", "=SUM(ALL)*K");
  const text = b.save();
  assert.equal(text, '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[{"name":"Main","cells":{"A1":"=SUM(ALL)*K"},"names":{}},{"name":"Data","cells":{"A1":"1","A2":"2","A3":"3"},"names":{}}],"names":{"ALL":"data!A1:A3","K":"=TRUE"}}');
  const c = loadWorkbook(text);
  assert.deepEqual(c.names(), { ALL: "data!A1:A3", K: "=TRUE" });
  assert.equal(c.sheet("main").get("A1"), 6);
  assert.equal(c.save(), text);
  b.removeName("ALL");
  b.removeName("K");
  assert.equal(b.save(), plain.replace('"cells":{}', '"cells":{"A1":"=SUM(ALL)*K"}'));
});

test("cp53h loadWorkbook checks names after every sheet", () => {
  const top = (names, sheets = '[{"name":"Main","cells":{},"names":{}}]') => `{"format":"workbook","version":2,"errorOrder":"priority","sheets":${sheets},"names":${names}}`;
  for (const [names, cell] of [["[]", "names"], ["null", "names"], ['"x"', "names"], ['{"k":"Main!A1"}', "names.k"], ['{"A1":"Main!A1"}', "names.A1"], ['{"K":"A1"}', "names.K"], ['{"K":"Main!a1"}', "names.K"], ['{"K":"Main!B2:A1"}', "names.K"], ['{"K":"=05"}', "names.K"], ['{"K":5}', "names.K"], ['{"J":"Main!A1","K":"Main!"}', "names.K"]]) {
    assert.throws(() => loadWorkbook(top(names)), thrown("#LOAD", cell), names);
  }
  assert.throws(() => loadWorkbook(top("[]", '[{"name":"Main","cells":{"a1":"1"},"names":{}}]')), thrown("#LOAD", "sheets.0.cells.a1"));
  const ok = loadWorkbook(top('{"K":"Gone!A1","L":"=\\"x\\""}'));
  assert.deepEqual(ok.names(), { K: "Gone!A1", L: '="x"' });
  const v1 = loadWorkbook('{"format":"sheet","version":1,"cells":{"A1":"=K"},"names":{"K":"=4"}}');
  assert.deepEqual(v1.names(), {});
  assert.deepEqual(v1.sheet("Sheet_1").names(), { K: "=4" });
  assert.equal(v1.sheet("Sheet_1").get("A1"), 4);
});

test("cp53h CHANGES.md has a cp53 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 53);
  assert.match(lines[52], /^- cp53: \S/);
  assert.notEqual(lines[52].slice(8).toLowerCase(), "workbook names");
});
