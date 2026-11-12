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
  return { b, m, d, x };
}

test("cp68h unqualified references gain the source sheet's name", () => {
  const { b, m, d } = book();
  d.setMany({ A1: "1", B1: "2", A2: "3", B2: "4" });
  d.set("C1", "=A1+B$1+$A2+$B$2+SUM(A1:B2)+COUNT($A$1:B2)");
  b.copy("Data!C1", "Main!D3");
  assert.equal(m.getInput("D3"), "=Data!B3+Data!C$1+Data!$A4+Data!$B$2+SUM(Data!B3:C4)+COUNT(Data!$A$1:C4)");
  d.set("C9", "=A1*10");
  b.copy("Data!C9", "Main!C9");
  assert.equal(m.getInput("C9"), "=Data!A1*10");
  assert.equal(m.get("C9"), 10);
  assert.deepEqual(m.precedents("C9"), ["Data!A1"]);
  d.set("A1", "5");
  assert.equal(m.get("C9"), 50);
});

test("cp68c chat: a reference to the target sheet loses its name; others keep theirs", () => {
  const { b, m, d } = book();
  m.set("C1", "100");
  d.set("A1", "=Main!C1+main!C2+MAIN!$C$1+Extra!A1+extra!B2:C3+Data!A2+data!A3");
  b.copy("Data!A1", "Main!B2");
  assert.equal(m.getInput("B2"), "=D2+D3+$C$1+Extra!B2+extra!C3:D4+Data!B3+data!B4");
  d.set("A5", "=SUM(Main!A1:B2, main!$A$1:C1)");
  b.copy("data!A5", "MAIN!A5");
  assert.equal(m.getInput("A5"), "=SUM(A1:B2, $A$1:C1)");
});

test("cp68h on one sheet book.copy is sheet copy", () => {
  const { b, d } = book();
  d.set("A1", "=B1+Data!B1+Main!B1+SUM(B1:B2)");
  b.copy("DATA!A1", "data!A3");
  assert.equal(d.getInput("A3"), "=B3+Data!B3+Main!B3+SUM(B3:B4)");
  d.copy("A1", "A4");
  assert.equal(d.getInput("A4"), "=B4+Data!B4+Main!B4+SUM(B4:B5)");
  d.set("C1", "1");
  d.set("C2", "=C1+1");
  b.copy("Data!C1:C2", "Data!C2");
  assert.equal(d.getInput("C3"), "=C2+1");
  assert.equal(d.get("C3"), 2);
});

test("cp68h names, LET names and function names are not references", () => {
  const { b, m, d } = book();
  d.defineConstant("RATE", 2);
  m.defineConstant("RATE", 10);
  b.defineConstant("BOOKK", 3);
  d.defineName("OWN", "A1");
  d.set("A1", "4");
  d.set("B1", "=A1*RATE+BOOKK");
  d.set("B2", "=OWN");
  d.set("B3", "=LET(x, A1, x*2)+A1(2)");
  b.copy("Data!B1:B3", "Main!B1");
  assert.equal(m.getInput("B1"), "=Data!A1*RATE+BOOKK");
  assert.equal(m.get("B1"), 43);
  assert.equal(d.get("B1"), 11);
  assert.equal(m.getInput("B2"), "=OWN");
  assert.equal(err(m.get("B2")), "#NAME?@B2");
  assert.equal(m.getInput("B3"), "=LET(x, Data!A1, x*2)+A1(2)");
});

test("cp68h #REF!, unparseable formulas, text and numbers", () => {
  const { b, m, d } = book();
  d.setMany({ B2: "=A1+C1", C2: "=SUM(A1:A2)+#REF!", D2: "=1+", E2: "007", F2: "Data!A1", G2: "=H$1" });
  b.copy("Data!B2:G2", "Main!A2");
  assert.equal(m.getInput("A2"), "=#REF!+Data!B1");
  assert.equal(m.getInput("B2"), "=SUM(#REF!)+#REF!");
  assert.equal(m.getInput("C2"), "=1+");
  assert.equal(m.getInput("D2"), "007");
  assert.equal(m.getInput("E2"), "Data!A1");
  assert.equal(m.getInput("F2"), "=Data!G$1");
  assert.equal(err(m.get("A2")), "#REF!@A2");
  assert.equal(err(m.get("C2")), "#PARSE!@C2");
});

test("cp68h spaces and lower-case references", () => {
  const { b, m, d } = book();
  d.setMany({ A1: "2", B1: "3" });
  d.set("C1", "= sum( a1 : b1 ) * a1");
  b.copy("Data!C1", "Main!C1");
  assert.equal(m.getInput("C1"), "= sum( Data!a1 : b1 ) * Data!a1");
  assert.equal(m.get("C1"), 10);
  b.copy("Data!C1", "Main!C2");
  assert.equal(m.getInput("C2"), "= sum( Data!A2 : B2 ) * Data!A2");
});

test("cp68h the sheet name is written as the workbook has it", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("sales_Q1");
  d.set("A1", "=B1");
  b.copy("SALES_q1!A1", "Main!A1");
  assert.equal(m.getInput("A1"), "=sales_Q1!B1");
  b.renameSheet("SALES_Q1", "Totals");
  b.copy("totals!A1", "Main!A2");
  assert.equal(m.getInput("A2"), "=Totals!B2");
  assert.equal(m.getInput("A1"), "=Totals!B1");
});

test("cp68h formats move with the copy; notes, rules and merges do not", () => {
  const { b, m, d } = book();
  d.setMany({ A1: "0.5", A2: "zz" });
  d.setFormat("A1", "0%");
  d.setNote("A1", "half");
  d.setValidation("A2", { type: "whole", min: 1, max: 2 });
  m.setFormat("B2", "0.00");
  m.setFormat("B3", "0.00");
  m.setValidation("B2:B3", { type: "list", items: ["only"] });
  m.merge("A3:B3");
  b.copy("Data!A1:A2", "Main!B2");
  assert.equal(m.display("B2"), "50%");
  assert.equal(m.getFormat("B3"), null);
  assert.equal(m.getNote("B2"), null);
  assert.equal(m.getInput("B3"), "zz");
  assert.deepEqual(m.getValidation("B2"), { type: "list", items: ["only"] });
  assert.equal(m.get("B3"), null);
  assert.deepEqual(m.invalidCells(), ["B2", "B3"]);
  assert.deepEqual(m.merges(), ["A3:B3"]);
});

test("cp68h empty source cells clear; one undo step and one event on the target", () => {
  const { b, m, d } = book();
  m.setMany({ A1: "old", A2: "old2", B9: "keep" });
  d.set("A2", "new");
  const log = [];
  m.onChange((e) => log.push(`Main ${e.cells.join()}`));
  d.onChange((e) => log.push(`Data ${e.cells.join()}`));
  b.copy("Data!A1:A2", "Main!A1");
  assert.equal(m.getInput("A1"), null);
  assert.equal(m.getInput("A2"), "new");
  assert.deepEqual(log, ["Main A1,A2"]);
  d.set("Z1", "z");
  assert.equal(b.undo(), true);
  assert.equal(d.getInput("Z1"), null);
  assert.equal(b.undo(), true);
  assert.equal(m.getInput("A1"), "old");
  assert.equal(m.getInput("A2"), "old2");
  assert.equal(b.redo(), true);
  assert.equal(m.getInput("A2"), "new");
  assert.equal(d.undo(), true);
  assert.equal(d.undo(), false);
});

test("cp68h limits are not checked; a batch rolls the copy back", () => {
  const { b, m, d } = book();
  let f = "=A1";
  while (f.length + 2 <= 1000) f += "+1";
  d.set("A2", f);
  d.set("A1", "1");
  b.copy("Data!A2", "Main!A2");
  assert.equal(m.getInput("A2").length, f.length + 5);
  assert.equal(m.get("A2"), d.get("A2"));
  assert.throws(() => b.batch(() => { b.copy("Data!A1", "Main!A2"); throw new Error("x"); }), /x/);
  assert.equal(m.getInput("A2").length, f.length + 5);
});

test("cp68h errors, in order, change nothing", () => {
  const { b, m } = book();
  m.set("A1", "1");
  for (const [from, to, code, cell] of [
    ["A1", "Main!A1", "#ADDR", "A1"],
    [null, null, "#ADDR", "null"],
    ["Data!A1:B2:C3", "Main!A1", "#ADDR", "Data!A1:B2:C3"],
    ["Data!A1:Data!B2", "Main!A1", "#ADDR", "Data!A1:Data!B2"],
    ["Data !A1", "Main!A1", "#ADDR", "Data !A1"],
    ["Sheet2!A1", "Main!A1", "#ADDR", "Sheet2!A1"],
    ["Data!$A$1", "Main!A1", "#ADDR", "Data!$A$1"],
    ["Data!A1", "Main!A1:B2", "#ADDR", "Main!A1:B2"],
    ["Data!A1", "B1", "#ADDR", "B1"],
    ["Nope!A1", "Gone!A0", "#ADDR", "Gone!A0"],
    ["Nope!A1", "Gone!A1", "#SHEET", "Nope"],
    ["Data!A1:ZZ9999", "Gone!A1", "#SHEET", "Gone"],
    ["Data!A1:ZZ9999", "Main!A1", "#ARG", "Data!A1:ZZ9999"],
    ["Data!A1:B2", "Main!ZZ1", "#ARG", "Main!ZZ1"],
    ["Data!A1:B2", "Main!A9999", "#ARG", "Main!A9999"],
  ]) {
    assert.throws(() => b.copy(from, to), thrown(code, cell), `${from} ${to}`);
  }
  b.copy("Data!A1", "Main!ZZ9999");
  assert.deepEqual(m.cells(), ["A1"]);
});

test("cp68h CHANGES.md has a cp68 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 68);
  assert.match(lines[67], /^- cp68: \S/);
  assert.notEqual(lines[67].slice(8).toLowerCase(), "copying across sheets");
});

test("cp68h recall: the event of a copy lists the target cells in row-major order", () => {
  const b = createWorkbook();
  const d = b.addSheet("Data");
  const m = b.addSheet("Main");
  d.setMany({ A1: "1", B1: "2", A2: "3", B2: "4" });
  const got = [];
  m.onChange((e) => got.push(e.cells));
  b.copy("Data!A1:B2", "Main!C1");
  assert.deepEqual(got, [["C1", "D1", "C2", "D2"]]);
});
