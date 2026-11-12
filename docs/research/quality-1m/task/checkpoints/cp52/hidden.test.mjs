// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, loadSheet, createWorkbook, loadWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
const err = (v) => (v && typeof v === "object" ? `${v.code}@${v.cell}` : v);
const at = (s, f, cell = "Z9") => { s.set(cell, f); return err(s.get(cell)); };

test("cp52h values keep their type: text that looks like a number stays text", () => {
  const s = createSheet();
  s.defineConstant("CODE", "5");
  s.defineConstant("N", 5);
  s.defineConstant("YES", true);
  s.defineConstant("EMPTY", "");
  assert.equal(at(s, "=CODE+1"), "#VALUE!@Z9");
  assert.equal(at(s, '=CODE&"x"'), "5x");
  assert.equal(at(s, "=CODE=5"), false);
  assert.equal(at(s, '=CODE="5"'), true);
  assert.equal(at(s, "=N+1"), 6);
  assert.equal(at(s, "=YES+1"), 2);
  assert.equal(at(s, "=YES"), true);
  assert.equal(at(s, "=LEN(EMPTY)"), 0);
  assert.equal(at(s, "=EMPTY"), "");
  assert.equal(s.display("Z9"), "");
  assert.equal(at(s, "=code"), "5");
});

test("cp52h a constant as a range argument is #VALUE!; as a value it works", () => {
  const s = createSheet();
  s.set("A1", "4");
  s.set("A2", "6");
  s.defineConstant("RATE", 0.25);
  s.defineConstant("FLAG", true);
  for (const f of ["=SUM(RATE)", "=COUNT(RATE)", "=AVERAGE(RATE, A1)", "=MAX(RATE)", "=AND(FLAG)", "=OR(FLAG, TRUE)", "=SUMPRODUCT(RATE)", "=SUMIF(RATE, 1)", "=COUNTIF(RATE, 1)", "=SUBTOTAL(9, RATE)", "=VLOOKUP(1, RATE, 1)", "=INDEX(RATE, 1)"]) {
    assert.equal(at(s, f), "#VALUE!@Z9", f);
  }
  assert.equal(at(s, "=SUM(A1:A2)*RATE"), 2.5);
  assert.equal(at(s, "=ROUND(RATE, 1)"), 0.2);
  assert.equal(at(s, "=IF(FLAG, 1, 2)"), 1);
  assert.equal(at(s, "=SUM(RATE*4, A1)"), 5);
  assert.equal(at(s, "=SUMIF(A1:A2, \">\"&RATE*20)"), 6);
  assert.equal(at(s, "=NOT(FLAG)"), false);
});

test("cp52h one namespace with cell names", () => {
  const s = createSheet();
  s.set("B1", "7");
  s.defineName("X", "B1");
  s.set("A1", "=X*2");
  s.set("A2", "=SUM(X)");
  assert.equal(s.get("A1"), 14);
  s.defineConstant("x", 10);
  assert.deepEqual(s.names(), { X: "=10" });
  assert.equal(s.get("A1"), 20);
  assert.equal(err(s.get("A2")), "#VALUE!@A2");
  s.defineName("X", "B1:B2");
  assert.equal(err(s.get("A1")), "#VALUE!@A1");
  assert.equal(s.get("A2"), 7);
  s.defineConstant("X", 3);
  assert.equal(s.removeName("x"), true);
  assert.equal(err(s.get("A1")), "#NAME?@A1");
  assert.equal(s.removeName("X"), false);
});

test("cp52h names() text for every kind of value", () => {
  const s = createSheet();
  s.defineConstant("A_", 0.1 + 0.2);
  s.defineConstant("B_", -3);
  s.defineConstant("C_", 1e21);
  s.defineConstant("D_", 'a "b"');
  s.defineConstant("E_", false);
  s.defineConstant("F_", -0);
  s.defineConstant("G_", "");
  s.defineConstant("H_", "=1+1");
  assert.deepEqual(s.names(), { A_: "=0.30000000000000004", B_: "=-3", C_: "=1e+21", D_: '="a ""b"""', E_: "=FALSE", F_: "=0", G_: '=""', H_: '="=1+1"' });
  s.set("A1", "=1/F_");
  assert.equal(err(s.get("A1")), "#DIV/0!@A1");
  s.set("A2", "=H_");
  assert.equal(s.get("A2"), "=1+1");
});

test("cp52h no precedents, recalculation of users only", () => {
  const s = createSheet();
  s.defineConstant("RATE", 2);
  s.set("A1", "=RATE*3");
  s.set("A2", "=A1+1");
  s.set("B1", "=1+1");
  assert.equal(s.get("A2"), 7);
  s.get("B1");
  assert.deepEqual(s.precedents("A1"), []);
  assert.deepEqual(s.explain("A1").from, []);
  const before = s.stats().evaluations;
  s.defineConstant("RATE", 2);
  assert.equal(s.get("A2"), 7);
  assert.equal(s.stats().evaluations, before);
  s.defineConstant("RATE", 5);
  assert.equal(s.get("A2"), 16);
  assert.equal(s.get("B1"), 2);
  assert.equal(s.stats().evaluations, before + 2);
  s.defineConstant("RATE", "5");
  assert.equal(err(s.get("A2")), "#VALUE!@A1");
});

test("cp52h undo and redo", () => {
  const s = createSheet();
  s.set("A1", "=K");
  s.defineConstant("K", 1);
  s.defineConstant("K", 1);
  s.defineConstant("K", true);
  s.defineName("K", "B1");
  assert.equal(s.get("A1"), 0);
  assert.equal(s.undo(), true);
  assert.equal(s.get("A1"), true);
  assert.equal(s.undo(), true);
  assert.equal(s.get("A1"), 1);
  assert.equal(s.undo(), true);
  assert.equal(err(s.get("A1")), "#NAME?@A1");
  assert.equal(s.undo(), true);
  assert.equal(s.getInput("A1"), null);
  assert.equal(s.redo(), true);
  assert.equal(s.redo(), true);
  assert.deepEqual(s.names(), { K: "=1" });
  assert.equal(s.get("A1"), 1);
});

test("cp52h insert and delete never touch constants", () => {
  const s = createSheet();
  s.defineConstant("K", 4);
  s.defineName("CELL", "A1");
  s.set("B1", "=K+CELL");
  s.set("A1", "1");
  s.deleteRows(1);
  assert.deepEqual(s.names(), { K: "=4" });
  s.set("B1", "=K*2");
  s.insertRows(1, 5);
  s.insertCols("A", 3);
  s.deleteCols("A", 9);
  assert.deepEqual(s.names(), { K: "=4" });
  s.set("A1", "=K");
  s.copy("A1", "C3");
  assert.equal(s.getInput("C3"), "=K");
  assert.equal(s.get("C3"), 4);
  assert.equal(typeof s.replace("K", "K"), "number");
  s.undo();
  s.undo();
  s.undo();
  assert.deepEqual(s.names(), { K: "=4" });
});

test("cp52h constants are saved and loaded", () => {
  const s = createSheet();
  s.set("A1", "=RATE*NAME_");
  s.defineConstant("RATE", 0.5);
  s.defineConstant("NAME_", 'x"y');
  s.defineConstant("ON", true);
  s.defineName("CELL", "b2:a1");
  const text = '{"format":"sheet","version":1,"cells":{"A1":"=RATE*NAME_"},"names":{"CELL":"A1:B2","NAME_":"=\\"x\\"\\"y\\"","ON":"=TRUE","RATE":"=0.5"}}';
  assert.equal(s.save(), text);
  const t = loadSheet(text);
  assert.deepEqual(t.names(), s.names());
  assert.equal(err(t.get("A1")), "#VALUE!@A1");
  t.defineConstant("NAME_", 4);
  assert.equal(t.get("A1"), 2);
  assert.equal(loadSheet(t.save()).get("A1"), 2);
  const b = createWorkbook();
  b.addSheet("Main").defineConstant("K", -1.5);
  assert.equal(b.save(), '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[{"name":"Main","cells":{},"names":{"K":"=-1.5"}}]}');
  assert.deepEqual(loadWorkbook(b.save()).sheet("main").names(), { K: "=-1.5" });
});

test("cp52h a target starting with = must be a constant written as names() writes it", () => {
  const bad = (names) => `{"format":"sheet","version":1,"cells":{},"names":${JSON.stringify(names)}}`;
  for (const target of ["= 5", "=05", "=+5", "=5.0", "=0x10", "=", "=true", "=\"a", "=\"a\"\"", "=A1", "=1e21", "=-0", "=Infinity", "=NaN", "=\"a\" "]) {
    assert.throws(() => loadSheet(bad({ K: target })), thrown("#LOAD", "K"), target);
  }
  assert.deepEqual(loadSheet(bad({ K: "=1e+21", L: '="a"""', M: "=-0.5" })).names(), { K: "=1e+21", L: '="a"""', M: "=-0.5" });
  const book = '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[{"name":"A","cells":{},"names":{"K":"=1"}},{"name":"B","cells":{},"names":{"K":"=x"}}]}';
  assert.throws(() => loadWorkbook(book), thrown("#LOAD", "sheets.1.names.K"));
});

test("cp52h defineConstant errors, in order, change nothing", () => {
  const s = createSheet();
  s.defineConstant("K", 1);
  for (const [name, value, code, cell] of [["A1", 1, "#BADNAME", "A1"], ["1K", NaN, "#BADNAME", "1K"], [null, 1, "#BADNAME", "null"], ["K", NaN, "#ARG", "NaN"], ["K", Infinity, "#ARG", "Infinity"], ["K", null, "#ARG", "null"], ["K", undefined, "#ARG", "undefined"], ["K", [1], "#ARG", "1"], ["K", 5n, "#ARG", "5"]]) {
    assert.throws(() => s.defineConstant(name, value), thrown(code, cell), `${name} ${String(value)}`);
  }
  assert.deepEqual(s.names(), { K: "=1" });
  assert.equal(s.undo(), true);
  assert.equal(s.undo(), false);
});

test("cp52h constants belong to one sheet", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  m.defineConstant("K", 2);
  d.set("A1", "=K");
  m.set("A1", "=K+Data!A1");
  assert.equal(err(d.get("A1")), "#NAME?@A1");
  assert.equal(err(m.get("A1")), "#NAME?@A1");
  d.defineConstant("K", 10);
  assert.equal(m.get("A1"), 12);
  b.renameSheet("Data", "Facts");
  assert.deepEqual(d.names(), { K: "=10" });
});

test("cp52h CHANGES.md has a cp52 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 52);
  assert.match(lines[51], /^- cp52: \S/);
  assert.notEqual(lines[51].slice(8).toLowerCase(), "named constants");
});

test("cp52h recall: names() sorts keys by the plain string comparison of checkpoint 14", () => {
  const s = createSheet();
  s.defineConstant("A_B", 1);
  s.defineConstant("AB", 2);
  s.defineConstant("A1B", 3);
  s.defineConstant("B", 4);
  assert.deepEqual(Object.keys(s.names()), ["A1B", "AB", "A_B", "B"]);
});
