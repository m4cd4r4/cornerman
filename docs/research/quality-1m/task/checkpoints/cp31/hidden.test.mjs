// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkbook, createSheet, loadSheet } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
const code = (v) => (v && typeof v === "object" ? v.code : v);
function book(...names) {
  const b = createWorkbook();
  const sheets = names.map((n) => b.addSheet(n));
  return [b, ...sheets];
}

test("cp31h sheet names: rule, case, order and lookup", () => {
  const b = createWorkbook();
  const data = b.addSheet("Data");
  b.addSheet("sheet_2");
  b.addSheet("_x");
  for (const bad of ["Sheet2", "A1", "My Sheet", "TRUE", "false", "", "2x", "a-b"]) {
    assert.throws(() => b.addSheet(bad), thrown("#BADNAME", bad));
  }
  assert.throws(() => b.addSheet(7), thrown("#BADNAME", "7"));
  assert.throws(() => b.addSheet("DATA"), thrown("#SHEET", "DATA"));
  assert.throws(() => b.addSheet("Sheet_2"), thrown("#SHEET", "Sheet_2"));
  assert.deepEqual(b.sheetNames(), ["Data", "sheet_2", "_x"]);
  assert.equal(b.sheet("dAtA"), data);
  assert.equal(b.sheet("Data"), b.sheet("DATA"));
  assert.throws(() => b.sheet("Nope"), thrown("#SHEET", "Nope"));
  assert.throws(() => b.sheet(3), thrown("#SHEET", "3"));
  assert.equal(b.removeSheet("SHEET_2"), true);
  assert.equal(b.removeSheet("sheet_2"), false);
  assert.equal(b.removeSheet(5), false);
  assert.equal(b.removeSheet("Nope"), false);
  assert.deepEqual(b.sheetNames(), ["Data", "_x"]);
  const again = b.addSheet("Sheet_2");
  assert.deepEqual(b.sheetNames(), ["Data", "_x", "Sheet_2"]);
  assert.deepEqual(again.cells(), []);
});

test("cp31h references to another sheet: cells, ranges, $ and case", () => {
  const [, main, data] = book("Main", "Data");
  data.set("B2", "3");
  data.set("C3", "4");
  data.set("C2", "x");
  main.set("A1", "=Data!B2+1");
  main.set("A2", "=SUM(Data!B2:C3)");
  main.set("A3", "=data!$b$2*DATA!C3");
  main.set("A4", "=COUNT(Data!B2:C3)");
  main.set("A5", '=Data!C2&"!"');
  main.set("A6", "=Main!A1*10");
  main.set("A7", "=VLOOKUP(3,Data!B2:C3,2)");
  assert.equal(main.get("A1"), 4);
  assert.equal(main.get("A2"), 7);
  assert.equal(main.get("A3"), 12);
  assert.equal(main.get("A4"), 2);
  assert.equal(main.get("A5"), "x!");
  assert.equal(main.get("A6"), 40);
  assert.equal(main.get("A7"), "x");
  assert.equal(main.getInput("A3"), "=data!$b$2*DATA!C3");
});

test("cp31h what follows the sheet name", () => {
  const [, main, data] = book("Main", "Data");
  data.set("A1", "1");
  data.defineName("rate", "A1");
  main.set("Z9", "1");
  const bad = ["=Data ! A1", "=Data !A1", "=Data! A1", "=Data!", "=Data!SUM(1)", "=Data!RATE", "=Data!A1:Data!B2",
    "=A1!B2", "=TRUE!B2", "=Data!#REF!", "=Data!(A1)", "=1+Data!", "=Data!!A1"];
  for (const f of bad) {
    main.set("B1", f);
    assert.equal(code(main.get("B1")), "#PARSE!", f);
    assert.equal(main.get("B1").cell, "B1", f);
  }
  main.set("B1", "=Data!A1 + Data!A1:A2");
  assert.equal(code(main.get("B1")), "#VALUE!");
  main.set("B1", "=SUM( Data!A1:A2 )");
  assert.equal(main.get("B1"), 1);
});

test("cp31h a missing sheet is #REF! until it is added", () => {
  const [b, main] = book("Main");
  main.set("A1", "=Later!A1+1");
  main.set("A2", "=COUNT(Later!A1:A3)");
  main.set("A3", "=COUNT(Later!A1)");
  main.set("A4", "=IF(TRUE,1,Later!A1)");
  for (const k of ["A1", "A2", "A3"]) assert.deepEqual([code(main.get(k)), main.get(k).cell], ["#REF!", k]);
  assert.equal(main.get("A4"), 1);
  const later = b.addSheet("LATER");
  assert.equal(main.get("A1"), 1);
  assert.equal(main.get("A2"), 0);
  later.set("A2", "5");
  assert.equal(main.get("A2"), 1);
  assert.equal(b.removeSheet("later"), true);
  assert.deepEqual([code(main.get("A1")), main.get("A1").cell], ["#REF!", "A1"]);
  assert.deepEqual([code(main.get("A2")), main.get("A2").cell], ["#REF!", "A2"]);
  assert.equal(main.getInput("A1"), "=Later!A1+1");
  const fresh = b.addSheet("Later");
  assert.equal(main.get("A2"), 0);
  fresh.set("A1", "9");
  assert.equal(main.get("A1"), 10);
});

test("cp31h sheets in no workbook", () => {
  const s = createSheet();
  s.set("A1", "2");
  s.set("B1", "=X!A1");
  s.set("B2", "=SUM(X!A1:A2)");
  assert.deepEqual([code(s.get("B1")), s.get("B1").cell], ["#REF!", "B1"]);
  assert.deepEqual([code(s.get("B2")), s.get("B2").cell], ["#REF!", "B2"]);
  const [, main, data] = book("Main", "Data");
  data.set("A1", "4");
  main.set("A1", "=Data!A1");
  main.set("A2", "=Main!A1");
  assert.equal(main.get("A2"), 4);
  const loaded = loadSheet(main.save());
  assert.equal(code(loaded.get("A1")), "#REF!");
  assert.equal(code(loaded.get("A2")), "#REF!");
  assert.equal(loaded.getInput("A1"), "=Data!A1");
});

test("cp31h a removed sheet keeps working on its own", () => {
  const [b, main, data] = book("Main", "Data");
  data.set("A1", "3");
  data.set("A2", "=A1*2");
  data.set("A3", "=Main!A1");
  main.set("A1", "=Data!A2");
  assert.equal(data.get("A3"), 6);
  assert.equal(b.removeSheet("Data"), true);
  assert.deepEqual(b.sheetNames(), ["Main"]);
  assert.equal(data.get("A2"), 6);
  assert.deepEqual([code(data.get("A3")), data.get("A3").cell], ["#REF!", "A3"]);
  data.set("A1", "10");
  assert.equal(data.get("A2"), 20);
  assert.equal(code(main.get("A1")), "#REF!");
  const other = b.addSheet("Data");
  assert.notEqual(other, data);
  assert.equal(b.sheet("Data"), other);
  assert.equal(main.get("A1"), 0);
  data.set("A2", "77");
  assert.equal(main.get("A1"), 0);
});

test("cp31h errors keep their own cell across sheets", () => {
  const [, main, data] = book("Main", "Data");
  data.set("C7", "=1/0");
  data.set("D9", "=nope");
  main.set("A1", "=Data!C7");
  main.set("A2", "=Data!C7+1");
  main.set("A3", "=SUM(Data!C7:D9)");
  main.set("A4", "=Data!D9");
  assert.deepEqual([code(main.get("A1")), main.get("A1").cell], ["#DIV/0!", "C7"]);
  assert.deepEqual([code(main.get("A2")), main.get("A2").cell], ["#DIV/0!", "C7"]);
  assert.deepEqual([code(main.get("A3")), main.get("A3").cell], ["#NAME?", "D9"]);
  assert.deepEqual([code(main.get("A4")), main.get("A4").cell], ["#NAME?", "D9"]);
  assert.equal(main.display("A1"), "#DIV/0!");
});

test("cp31h values follow every kind of change on the other sheet", () => {
  const [, main, data] = book("Main", "Data");
  main.set("A1", "=Data!A1+Data!A2");
  data.set("A1", "1");
  assert.equal(main.get("A1"), 1);
  data.fromCSV("5\n6");
  assert.equal(main.get("A1"), 11);
  data.copy("A1", "A2");
  assert.equal(main.get("A1"), 10);
  data.undo();
  assert.equal(main.get("A1"), 11);
  data.redo();
  assert.equal(main.get("A1"), 10);
  data.deleteRows(1);
  assert.equal(main.get("A1"), 5);
  data.undo();
  assert.equal(main.get("A1"), 10);
  data.insertCols("A");
  assert.equal(main.get("A1"), 0);
  data.undo();
  data.set("A2", "");
  assert.equal(main.get("A1"), 5);
  assert.equal(main.toCSV(), "5");
  main.set("B1", "=Data!B5");
  assert.equal(main.get("B1"), 0);
  data.set("B4", "9");
  data.insertRows(1);
  assert.equal(main.get("B1"), 9);
});

test("cp31h row and column operations leave sheet-named references alone", () => {
  const [, main, data] = book("Main", "Data");
  data.set("A1", "1");
  data.set("A2", "2");
  main.set("B2", "=Data!A1+A1");
  main.set("C3", "=Main!A1+SUM(Data!A1:A2)");
  main.set("A1", "100");
  data.insertRows(1);
  assert.equal(main.getInput("B2"), "=Data!A1+A1");
  assert.equal(main.get("B2"), 100);
  assert.equal(data.getInput("A2"), "1");
  main.insertRows(1);
  assert.equal(main.getInput("B3"), "=Data!A1+A2");
  assert.equal(main.getInput("C4"), "=Main!A1+SUM(Data!A1:A2)");
  assert.equal(main.get("C4"), 1);
  main.insertCols("A", 2);
  assert.equal(main.getInput("D3"), "=Data!A1+C2");
  main.deleteRows(1, 2);
  assert.equal(main.getInput("D1"), "=Data!A1+#REF!");
  assert.deepEqual(main.cells(), ["D1", "E2"]);
  assert.equal(main.getInput("E2"), "=Main!A1+SUM(Data!A1:A2)");
});

test("cp31h copy shifts references with a sheet name", () => {
  const [, main, data] = book("Main", "Data");
  data.set("B2", "1");
  data.set("B3", "2");
  data.set("C3", "3");
  main.set("A1", "=Data!B2+data!$B$2+Data!B$2+SUM(Data!B2:B3)");
  main.copy("A1", "B2");
  assert.equal(main.getInput("B2"), "=Data!C3+data!$B$2+Data!C$2+SUM(Data!C3:C4)");
  assert.equal(main.get("B2"), 3 + 1 + 0 + 3);
  main.copy("A1", "A9999");
  assert.equal(main.getInput("A9999"), "=#REF!+data!$B$2+Data!B$2+SUM(#REF!)");
});

test("cp31h undo lists and defined names belong to one sheet", () => {
  const b = createWorkbook();
  const main = b.addSheet("Main");
  assert.equal(main.undo(), false);
  const data = b.addSheet("Data");
  data.set("A1", "4");
  main.set("A1", "=Data!A1");
  data.set("A1", "8");
  assert.equal(main.undo(), true);
  assert.equal(main.getInput("A1"), null);
  assert.equal(data.get("A1"), 8);
  assert.equal(main.undo(), false);
  assert.equal(main.redo(), true);
  assert.equal(main.get("A1"), 8);
  b.addSheet("Extra");
  b.removeSheet("Extra");
  assert.equal(data.undo(), true);
  assert.equal(main.get("A1"), 4);
  assert.equal(data.undo(), true);
  assert.equal(data.undo(), false);
  data.defineName("rate", "A1");
  main.set("B1", "=rate");
  assert.equal(code(main.get("B1")), "#NAME?");
  main.defineName("rate", "A1");
  assert.equal(main.get("B1"), 0);
  assert.deepEqual(data.names(), { RATE: "A1" });
});
