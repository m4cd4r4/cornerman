// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet, loadSheet } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
function sheet(setup = {}) {
  const s = createSheet();
  for (const [k, v] of Object.entries(setup)) s.set(k, v);
  return s;
}
const doc = (cells = {}, names = {}, extra = {}) => JSON.stringify({ format: "sheet", version: 1, cells, names, ...extra });

test("cp30h exact save text, cell and name order", () => {
  assert.equal(createSheet().save(), '{"format":"sheet","version":1,"cells":{},"names":{}}');
  const s = sheet({ B2: "=A1*2", A1: "3", AA1: "x", A10: "=1+", C1: '="q"' });
  s.defineName("rate", "b2");
  s.defineName("Box", "C3:A1");
  s.defineName("one", "A1:A1");
  assert.equal(
    s.save(),
    '{"format":"sheet","version":1,"cells":{"A1":"3","C1":"=\\"q\\"","AA1":"x","B2":"=A1*2","A10":"=1+"},"names":{"BOX":"A1:C3","ONE":"A1:A1","RATE":"B2"}}',
  );
  s.set("AA1", "");
  s.removeName("box");
  assert.equal(s.save(), doc({ A1: "3", C1: '="q"', B2: "=A1*2", A10: "=1+" }, { ONE: "A1:A1", RATE: "B2" }));
});

test("cp30h save evaluates nothing and is not an undo step", () => {
  const s = sheet({ A1: "2", B1: "=A1+1" });
  const before = s.stats().evaluations;
  s.save();
  assert.equal(s.stats().evaluations, before);
  assert.equal(s.get("B1"), 3);
  s.save();
  assert.equal(s.undo(), true);
  assert.equal(s.save(), doc({ A1: "2" }));
});

test("cp30h a loaded sheet is fresh and equal", () => {
  const s = sheet({ A1: "3", B2: "=A1*2", C3: "=ONE", D4: "=SUM(ONE)", A10: "=1+" });
  s.defineName("one", "A1:A1");
  s.get("B2");
  const t = loadSheet(s.save());
  assert.equal(t.save(), s.save());
  assert.deepEqual(t.stats(), { evaluations: 0 });
  assert.equal(t.undo(), false);
  assert.equal(t.redo(), false);
  assert.equal(t.get("B2"), 6);
  assert.equal(t.get("C3").code, "#VALUE!");
  assert.equal(t.get("D4"), 3);
  assert.equal(t.get("A10").code, "#PARSE!");
  assert.equal(t.stats().evaluations, 4);
  assert.deepEqual(t.cells(), s.cells());
  assert.deepEqual(t.names(), { ONE: "A1:A1" });
  assert.deepEqual(t.dependents("A1"), ["B2", "C3", "D4"]);
});

test("cp30h loaded and saved sheets are independent", () => {
  const s = sheet({ A1: "1", B1: "=A1+1" });
  const t = loadSheet(s.save());
  t.set("A1", "10");
  t.defineName("X", "B1");
  assert.equal(t.get("B1"), 11);
  assert.equal(s.get("B1"), 2);
  assert.deepEqual(s.names(), {});
  s.set("C1", "c");
  assert.equal(t.getInput("C1"), null);
  assert.equal(t.undo(), true);
  assert.equal(t.undo(), true);
  assert.equal(t.undo(), false);
  assert.equal(t.get("B1"), 2);
});

test("cp30h loading accepts any cell order, spacing and extra keys", () => {
  const text = `\n {\n "version": 1, "names": {"R": "B1"}, "x": [1],\n "cells": {"B1": "1", "A1": "=R+1"}, "format": "sheet" }\n`;
  const t = loadSheet(text);
  assert.equal(t.get("A1"), 2);
  assert.equal(t.save(), doc({ A1: "=R+1", B1: "1" }, { R: "B1" }));
  const u = loadSheet(doc({ ZZ9999: "x", A1: "$" }, { BIG: "A1:CV100" }));
  assert.equal(u.getInput("ZZ9999"), "x");
  assert.equal(u.get("A1"), "$");
  t.insertRows(1);
  assert.equal(t.getInput("A2"), "=R+1");
  assert.deepEqual(t.names(), { R: "B2" });
  assert.equal(t.undo(), true);
  assert.equal(t.save(), doc({ A1: "=R+1", B1: "1" }, { R: "B1" }));
});

test("cp30h top-level errors in order", () => {
  const cases = [
    [5, ""],
    [null, ""],
    ["", ""],
    ["nope", ""],
    ["[]", ""],
    ["null", ""],
    ['"sheet"', ""],
    [JSON.stringify({ version: 1, cells: {}, names: {} }), "format"],
    [JSON.stringify({ format: "book", version: 1, cells: {}, names: {} }), "format"],
    [JSON.stringify({ format: "SHEET", version: 1, cells: {}, names: {} }), "format"],
    [JSON.stringify({ format: "sheet", version: 2, cells: {}, names: {} }), "version"],
    [JSON.stringify({ format: "sheet", version: "1", cells: {}, names: {} }), "version"],
    [JSON.stringify({ format: "book", version: 2 }), "format"],
    [JSON.stringify({ format: "sheet", version: 1, cells: [], names: {} }), "cells"],
    [JSON.stringify({ format: "sheet", version: 1, cells: null, names: {} }), "cells"],
    [JSON.stringify({ format: "sheet", version: 1, cells: 5 }), "cells"],
    [JSON.stringify({ format: "sheet", version: 1, cells: { A0: "x" } }), "names"],
    [JSON.stringify({ format: "sheet", version: 1, cells: {}, names: [] }), "names"],
  ];
  for (const [text, cell] of cases) assert.throws(() => loadSheet(text), thrown("#LOAD", cell), String(text));
});

test("cp30h cell and name errors name the first bad key", () => {
  const cases = [
    [doc({ a1: "x" }), "a1"],
    [doc({ A1: "" }), "A1"],
    [doc({ A1: 5 }), "A1"],
    [doc({ A1: null }), "A1"],
    [doc({ A0: "x" }), "A0"],
    [doc({ A10000: "x" }), "A10000"],
    [doc({ $A$1: "x" }), "$A$1"],
    [doc({ "A1:B2": "x" }), "A1:B2"],
    [doc({ B1: "x", A0: "y", C0: "z" }), "A0"],
    [doc({ A0: "x" }, { bad: 1 }), "A0"],
    [doc({}, { rate: "A1" }), "rate"],
    [doc({}, { RATE: "a1" }), "RATE"],
    [doc({}, { R: "B3:A1" }), "R"],
    [doc({}, { A1: "A1" }), "A1"],
    [doc({}, { TRUE: "A1" }), "TRUE"],
    [doc({}, { R: 5 }), "R"],
    [doc({}, { R: "A1:CV101" }), "R"],
    [doc({}, { R: "$A$1" }), "R"],
    [doc({}, { OK: "A1", r2: "B1", BAD: "x" }), "r2"],
  ];
  for (const [text, cell] of cases) assert.throws(() => loadSheet(text), thrown("#LOAD", cell), text);
});
