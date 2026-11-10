// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;

test("cp77h the range is always two corners, top-left first, upper case", () => {
  const s = createSheet();
  s.set("B2", "1");
  assert.equal(s.exportJSON("b2"), '{"range":"B2:B2","values":[[1]]}');
  assert.equal(s.exportJSON("C3:a1"), '{"range":"A1:C3","values":[[null,null,null],[null,1,null],[null,null,null]]}');
  assert.equal(s.exportJSON("A3:B1"), '{"range":"A1:B3","values":[[null,null],[null,1],[null,null]]}');
  assert.equal(JSON.parse(s.exportJSON("ZZ9999")).range, "ZZ9999:ZZ9999");
});

test("cp77h values: full numbers, formats ignored, booleans, typed text, empty and non-finite", () => {
  const s = createSheet();
  s.setMany({ A1: "=0.1+0.2", B1: "0.25", C1: "=TRUE", D1: "TRUE", E1: "007", F1: "1e3", A2: "=Z9", B2: "-2.5", C2: "=10^400", D2: '=""', E2: "=-10^400" });
  s.setFormat("B1", "0%");
  s.setFormat("A1", "0.00");
  assert.equal(s.exportJSON("A1:F2"), '{"range":"A1:F2","values":[[0.30000000000000004,0.25,true,"TRUE",7,"1e3"],[0,-2.5,null,"",null,null]]}');
});

test("cp77h an error is an object with its own code and cell; error-looking text stays text", () => {
  const s = createSheet({ errorOrder: "first" });
  s.setMany({ A1: "=1/0", B1: "=A1+nope", C1: "#N/A", D1: "=1+", E1: "=E1" });
  const v = JSON.parse(s.exportJSON("A1:E1")).values[0];
  assert.deepEqual(v, [{ error: "#DIV/0!", cell: "A1" }, { error: "#DIV/0!", cell: "A1" }, "#N/A", { error: "#PARSE!", cell: "D1" }, { error: "#CYCLE!", cell: "E1" }]);
  const p = createSheet();
  p.setMany({ A1: "=1/0", B1: "=A1+nope" });
  assert.equal(p.exportJSON("B1"), '{"range":"B1:B1","values":[[{"error":"#NAME?","cell":"B1"}]]}');
});

test("cp77h display gives the shown text: formats, decimal comma, codes, empty strings", () => {
  const s = createSheet({ decimal: "," });
  s.setMany({ A1: "1234.5", B1: "=1/3", C1: "=1/0", D1: "=TRUE", E1: "x", G1: "=10^20", A2: "0.575" });
  s.setFormat("A1", "#,##0.00");
  s.setFormat("A2", "0%");
  assert.equal(s.exportJSON("A1:G2", { display: true }), '{"range":"A1:G2","values":[["1.234,50","0,333333","#DIV/0!","TRUE","x","","##########"],["58%","","","","","",""]]}');
  assert.deepEqual(JSON.parse(s.exportJSON("A1:B1", { display: true })).values, [[s.text("A1"), s.text("B1")]]);
  assert.equal(s.exportJSON("B1", { display: false }), '{"range":"B1:B1","values":[[0.3333333333333333]]}');
});

test("cp77h hidden rows and columns are included; covered cells read empty", () => {
  const s = createSheet();
  s.setMany({ A1: "1", B1: "2", C1: "3", A2: "4", B2: "5", C2: "6" });
  s.hideRows(1);
  s.hideCols("B");
  assert.equal(s.toCSV(), "4,6");
  assert.equal(s.exportJSON("A1:C2"), '{"range":"A1:C2","values":[[1,2,3],[4,5,6]]}');
  s.setFormat("B2", "0.0");
  s.merge("A2:B2");
  assert.equal(s.exportJSON("A2:C2", { formats: true }), '{"range":"A2:C2","values":[[4,null,6]],"formats":[[null,"0.0",null]]}');
  assert.equal(s.exportJSON("A2:C2", { display: true, formats: true }), '{"range":"A2:C2","values":[["4","","6"]],"formats":[[null,"0.0",null]]}');
});

test("cp77h formats come after values, for every cell, only when asked", () => {
  const s = createSheet();
  s.setFormat("A1:B1", "0.00");
  s.setFormat("B2", "0%");
  s.set("A2", "1");
  assert.equal(s.exportJSON("A1:B2", { formats: true }), '{"range":"A1:B2","values":[[null,null],[1,null]],"formats":[["0.00","0.00"],[null,"0%"]]}');
  assert.equal(s.exportJSON("A1:B2", { formats: false }), '{"range":"A1:B2","values":[[null,null],[1,null]]}');
  assert.equal(s.exportJSON("A1:B2", { other: 1 }), s.exportJSON("A1:B2"));
  s.insertRows(1);
  assert.equal(s.exportJSON("A1:B3", { formats: true }), '{"range":"A1:B3","values":[[null,null],[null,null],[1,null]],"formats":[[null,null],["0.00","0.00"],[null,"0%"]]}');
});

test("cp77h errors: the target first, then the options", () => {
  const s = createSheet();
  for (const [t, o, code, cell] of [
    ["A0", undefined, "#ADDR", "A0"], [null, {}, "#ADDR", "null"], ["A1:B2:C3", null, "#ADDR", "A1:B2:C3"], ["A1:B5001", 5, "#ARG", "A1:B5001"],
    ["A1", null, "#ARG", "null"], ["A1", [], "#ARG", ""], ["A1", "x", "#ARG", "x"], ["A1", 0, "#ARG", "0"],
    ["A1", { display: "yes" }, "#ARG", "display"], ["A1", { formats: 1 }, "#ARG", "formats"], ["A1", { formats: null, display: 0 }, "#ARG", "display"],
  ]) {
    assert.throws(() => s.exportJSON(t, o), thrown(code, cell), `${t} ${JSON.stringify(o)}`);
  }
  assert.equal(JSON.parse(s.exportJSON("A1:CV100")).values.length, 100);
});

test("cp77h it evaluates as value does and changes nothing", () => {
  const s = createSheet();
  s.setMany({ A1: "2", B1: "=A1*3", C1: "=B1+1" });
  const seen = [];
  s.onChange((e) => seen.push(e));
  assert.equal(s.exportJSON("B1:C1"), '{"range":"B1:C1","values":[[6,7]]}');
  assert.equal(s.stats().evaluations, 2);
  s.exportJSON("A1:C1", { display: true, formats: true });
  assert.equal(s.stats().evaluations, 2);
  assert.deepEqual(seen, []);
  assert.deepEqual(s.undoList(), ["setMany"]);
  assert.deepEqual(s.addresses(), ["A1", "B1", "C1"]);
  s.set("A1", "3");
  assert.equal(s.exportJSON("C1"), '{"range":"C1:C1","values":[[10]]}');
});

test("cp77h text is escaped as JSON.stringify escapes it, and the text parses back", () => {
  const s = createSheet();
  s.setMany({ A1: 'say "hi"', B1: "back\\slash", C1: "é €", D1: '=A1&"!"' });
  const text = s.exportJSON("A1:D1");
  assert.equal(text, JSON.stringify({ range: "A1:D1", values: [['say "hi"', "back\\slash", "é €", 'say "hi"!']] }));
  assert.deepEqual(JSON.parse(text).values[0][3], 'say "hi"!');
});

test("cp77h a sheet of a workbook exports values read from other sheets", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.set("A1", "5");
  m.setMany({ A1: "=Data!A1*2", B1: "=Gone!A1" });
  assert.equal(m.exportJSON("A1:B1"), '{"range":"A1:B1","values":[[10,{"error":"#REF!","cell":"B1"}]]}');
  d.set("A1", "=1/0");
  assert.equal(m.exportJSON("A1"), '{"range":"A1:A1","values":[[{"error":"#DIV/0!","cell":"A1"}]]}');
  b.deleteSheet("Data");
  assert.equal(m.formula("A1"), "=#REF!*2");
  assert.equal(m.exportJSON("A1"), '{"range":"A1:A1","values":[[{"error":"#REF!","cell":"A1"}]]}');
});

test("cp77h CHANGES.md has a cp77 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 77);
  assert.match(lines[76], /^- cp77: \S/);
  assert.notEqual(lines[76].slice(8).toLowerCase(), "range export to json");
});
