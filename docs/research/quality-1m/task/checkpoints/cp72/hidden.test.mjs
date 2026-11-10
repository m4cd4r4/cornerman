// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const row = (address, code, cell = address) => ({ address, code, cell });
const brief = (list) => list.map((x) => `${x.sheet ? x.sheet + "!" : ""}${x.address} ${x.code} ${x.cell}`);

test("cp72h ordered by priority, #PARSE! last, row-major within a code", () => {
  const s = createSheet();
  s.setMany({
    A1: "=1/0", Z99: "=nope", B2: "=1+", C1: "=A1+1", A3: '="x"*2', B3: "=VLOOKUP(9, D1:E2, 2)",
    D9: "=#REF!", E1: "=E2", E2: "=E1", A2: "=SUM(C1)", F1: "=1/0",
  });
  assert.deepEqual(brief(s.errorCells()), [
    "E1 #CYCLE! E1", "E2 #CYCLE! E2", "D9 #REF! D9", "Z99 #NAME? Z99", "B3 #N/A B3", "A3 #VALUE! A3",
    "A1 #DIV/0! A1", "C1 #DIV/0! A1", "F1 #DIV/0! F1", "A2 #DIV/0! A1", "B2 #PARSE! B2",
  ]);
});

test("cp72h the error order option changes values, never the list's order", () => {
  for (const errorOrder of ["priority", "first"]) {
    const s = createSheet({ errorOrder });
    s.setMany({ A1: "=1/0", B1: "=nope", C1: "=A1+B1", A2: "=B1+A1" });
    const c1 = errorOrder === "first" ? row("C1", "#DIV/0!", "A1") : row("C1", "#NAME?", "B1");
    const a2 = row("A2", "#NAME?", "B1");
    const want = errorOrder === "first" ? [row("B1", "#NAME?"), a2, row("A1", "#DIV/0!"), c1] : [row("B1", "#NAME?"), c1, a2, row("A1", "#DIV/0!")];
    assert.deepEqual(s.errorCells(), want, errorOrder);
  }
});

test("cp72h caught errors, text, values and empty cells are not listed", () => {
  const s = createSheet();
  s.setMany({ A1: "=IFERROR(1/0, 0)", A2: "#DIV/0!", A3: "=ISERROR(1/0)", A4: "=B9", A5: '="#REF!"', A6: "=IF(TRUE, 1, 1/0)" });
  assert.deepEqual(s.errorCells(), []);
  s.set("B9", "=1/0");
  assert.deepEqual(brief(s.errorCells()), ["A4 #DIV/0! B9", "B9 #DIV/0! B9"]);
});

test("cp72h covered cells are not listed; hidden rows are", () => {
  const s = createSheet();
  s.setMany({ A1: "=1/0", B1: "=nope", A2: "=1+" });
  s.merge("A1:B1");
  s.hideRows(2);
  assert.deepEqual(brief(s.errorCells()), ["A1 #DIV/0! A1", "A2 #PARSE! A2"]);
  s.unmerge("A1");
  s.showRows(2);
  assert.deepEqual(brief(s.errorCells()), ["B1 #NAME? B1", "A1 #DIV/0! A1", "A2 #PARSE! A2"]);
});

test("cp72h errors from other sheets keep their own unqualified cell", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.set("C5", "=1/0");
  m.setMany({ A1: "=Data!C5", B1: "=Nope!A1", C1: "=SUM(Data!C1:C9)" });
  assert.deepEqual(m.errorCells(), [row("B1", "#REF!"), row("A1", "#DIV/0!", "C5"), row("C1", "#DIV/0!", "C5")]);
  b.addSheet("Gone").set("A1", "1");
  m.set("D1", "=Gone!A1");
  b.deleteSheet("Gone");
  assert.equal(m.getInput("D1"), "=#REF!");
  assert.deepEqual(brief(m.errorCells()).slice(0, 2), ["B1 #REF! B1", "D1 #REF! D1"]);
});

test("cp72h book.errorCells orders by code across sheets, then sheet order", () => {
  const b = createWorkbook();
  const z = b.addSheet("zeta");
  const a = b.addSheet("Alpha");
  z.setMany({ A1: "=1/0", B1: "=Alpha!Q1" });
  a.setMany({ A1: "=nope", Q1: "=1/0", B2: "=Missing!A1", C1: "=1+" });
  assert.deepEqual(brief(b.errorCells()), [
    "Alpha!B2 #REF! B2", "Alpha!A1 #NAME? A1", "zeta!A1 #DIV/0! A1", "zeta!B1 #DIV/0! Q1", "Alpha!Q1 #DIV/0! Q1", "Alpha!C1 #PARSE! C1",
  ]);
  b.renameSheet("zeta", "Zed");
  b.removeSheet("Alpha");
  b.addSheet("Alpha").set("A1", "=1/0");
  b.addSheet("Beta");
  assert.deepEqual(brief(b.errorCells()), ["Zed!A1 #DIV/0! A1", "Alpha!A1 #DIV/0! A1"]);
  assert.equal(z.get("B1"), 0);
  assert.deepEqual(brief(a.errorCells()), ["B2 #REF! B2", "A1 #NAME? A1", "Q1 #DIV/0! Q1", "C1 #PARSE! C1"]);
  assert.deepEqual(createWorkbook().errorCells(), []);
});

test("cp72h evaluates as get does and changes nothing", () => {
  const s = createSheet();
  s.setMany({ A1: "=1/0", B1: "=A1*2", C1: "=B1&\"\"", D1: "3", E1: "=D1+1" });
  const seen = [];
  s.onChange((e) => seen.push(e.cells));
  const before = s.stats().evaluations;
  assert.equal(s.errorCells().length, 3);
  assert.equal(s.stats().evaluations, before + 4);
  assert.equal(s.errorCells().length, 3);
  assert.equal(s.stats().evaluations, before + 4);
  s.set("D1", "4");
  s.errorCells();
  assert.equal(s.stats().evaluations, before + 5);
  assert.deepEqual(seen, [["D1"]]);
  assert.equal(s.undo(), true);
  assert.equal(s.undo(), true);
  assert.equal(s.undo(), false);
});

test("cp72h a cycle across sheets and a long chain", () => {
  const b = createWorkbook();
  const p = b.addSheet("P");
  const q = b.addSheet("Q");
  p.set("A1", "=Q!A1+1");
  q.set("A1", "=P!A1+1");
  assert.deepEqual(brief(b.errorCells()), ["P!A1 #CYCLE! A1", "Q!A1 #CYCLE! A1"]);
  const s = createSheet();
  s.set("A1", "=1/0");
  for (let r = 2; r <= 3000; r++) s.set(`A${r}`, `=A${r - 1}+1`);
  const list = s.errorCells();
  assert.equal(list.length, 3000);
  assert.deepEqual(list[2999], row("A3000", "#DIV/0!", "A1"));
});

test("cp72h CHANGES.md has a cp72 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 72);
  assert.match(lines[71], /^- cp72: \S/);
  assert.notEqual(lines[71].slice(8).toLowerCase(), "error audit");
});
