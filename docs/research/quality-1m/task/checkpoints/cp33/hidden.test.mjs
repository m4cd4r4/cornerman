// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet, loadSheet, createWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;

test("cp33h new names match the old ones", () => {
  const s = createSheet();
  s.setCell("b2", "=1/0");
  s.setCell("A1", "1.50");
  assert.deepEqual(s.value("B2"), s.get("B2"));
  assert.equal(s.value("B2").code, "#DIV/0!");
  assert.equal(s.text("A1"), "1.5");
  assert.equal(s.text("B2"), "#DIV/0!");
  assert.equal(s.value("Z9"), null);
  assert.equal(s.text("Z9"), "");
  assert.deepEqual(s.addresses(), ["A1", "B2"]);
  assert.equal(s.formula("A1"), "1.50");
  assert.equal(s.formula("Z9"), "");
  assert.equal(s.getInput("Z9"), null);
  for (const m of ["setCell", "value", "text", "formula"]) assert.throws(() => (m === "setCell" ? s[m]("A0", "1") : s[m]("A0")), thrown("#ADDR", "A0"), m);
  assert.equal(s.undo(), true);
  assert.equal(s.formula("A1"), "");
});

test("cp33h setMany is one undo step in key order", () => {
  const s = createSheet();
  s.set("C1", "keep");
  s.setMany({ a1: "2", B1: "=A1*3", A1: "5", C1: "keep" });
  assert.equal(s.value("B1"), 15);
  assert.equal(s.formula("A1"), "5");
  assert.deepEqual(s.cells(), ["A1", "B1", "C1"]);
  assert.equal(s.undo(), true);
  assert.deepEqual(s.cells(), ["C1"]);
  assert.equal(s.redo(), true);
  assert.equal(s.value("B1"), 15);
  s.setMany({ A1: "5", B1: "=A1*3" });
  assert.equal(s.undo(), true);
  assert.deepEqual(s.cells(), ["C1"]);
  s.setMany({});
  s.setMany({ C1: "keep" });
  assert.equal(s.undo(), true);
  assert.equal(s.undo(), false);
  s.setMany({ C1: "back", D4: "=C1&\"!\"" });
  assert.equal(s.value("D4"), "back!");
  s.undo();
  assert.deepEqual(s.cells(), []);
});

test("cp33h setMany checks every address first", () => {
  const s = createSheet();
  s.set("A1", "1");
  assert.throws(() => s.setMany({ A2: "9", A0: "1", ZZZ1: "2" }), thrown("#ADDR", "A0"));
  assert.throws(() => s.setMany({ A2: "9", " A3": "1" }), thrown("#ADDR", " A3"));
  assert.throws(() => s.setMany({ Q0: "1", A0: "2" }), thrown("#ADDR", "Q0"));
  assert.throws(() => s.setMany({ b0: "1", B1: "2", a0: "3" }), thrown("#ADDR", "b0"));
  assert.deepEqual(s.cells(), ["A1"]);
  assert.equal(s.undo(), true);
  assert.equal(s.undo(), false);
  for (const bad of [null, ["A1"], "A1", 3, undefined]) assert.throws(() => s.setMany(bad), thrown("#ARG", ""));
});

test("cp33h every kind of sheet has the new names", () => {
  const a = createSheet();
  a.set("A1", "=2+2");
  const b = loadSheet(a.save());
  assert.equal(b.value("A1"), 4);
  b.setMany({ B1: "=A1" });
  assert.equal(b.text("B1"), "4");
  const book = createWorkbook();
  const main = book.addSheet("Main");
  assert.equal(book.get("MAIN"), main);
  assert.equal(book.get("main"), book.sheet("Main"));
  assert.throws(() => book.get("Nope"), thrown("#SHEET", "Nope"));
  main.setMany({ A1: "=Data!A1+1" });
  book.addSheet("Data").setCell("A1", "6");
  assert.equal(main.value("A1"), 7);
  const { get } = book;
  assert.equal(get("Main"), main);
});
