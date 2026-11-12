// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook, loadSheet, loadWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
function watched(s) {
  const seen = [];
  s.onChange((e) => seen.push(e.cells));
  return seen;
}

test("cp65h off, double registration and the listener check", () => {
  const s = createSheet();
  const calls = [];
  const f = (e) => calls.push(e.cells.join());
  const off1 = s.onChange(f);
  const off2 = s.onChange(f);
  s.set("A1", "1");
  assert.deepEqual(calls, ["A1", "A1"]);
  assert.equal(off1(), true);
  assert.equal(off1(), false);
  s.set("A1", "2");
  assert.deepEqual(calls, ["A1", "A1", "A1"]);
  assert.equal(off2(), true);
  s.set("A1", "3");
  assert.equal(calls.length, 3);
  for (const [v, cell] of [[null, "null"], [undefined, "undefined"], ["f", "f"], [{}, "[object Object]"], [5, "5"]]) {
    assert.throws(() => s.onChange(v), thrown("#ARG", cell));
  }
});

test("cp65h only inputs: values that change through formulas are not listed", () => {
  const s = createSheet();
  s.setMany({ A1: "1", B1: "=A1*2", C1: "=B1+1" });
  const seen = watched(s);
  s.set("A1", "5");
  assert.equal(s.get("C1"), 11);
  assert.deepEqual(seen, [["A1"]]);
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  m.set("A1", "=Data!A1+1");
  const ms = watched(m);
  const ds = watched(d);
  d.set("A1", "4");
  assert.equal(m.get("A1"), 5);
  assert.deepEqual(ms, []);
  assert.deepEqual(ds, [["A1"]]);
});

test("cp65h formats, notes, rules, merges, hiding, names and reads fire nothing", () => {
  const s = createSheet();
  s.setMany({ A1: "1", A2: "2", B1: "=A1" });
  const seen = watched(s);
  s.setFormat("A1:A2", "0.00");
  s.setNote("A1", "hi");
  s.setValidation("C1", { type: "whole", min: 1, max: 9 });
  s.merge("A1:B1");
  s.unmerge("A1");
  s.hideRows(2);
  s.showRows(2);
  s.defineName("X", "A1:A2");
  s.defineConstant("K", 3);
  s.removeName("X");
  s.get("B1");
  s.display("A1");
  s.recalc();
  s.toCSV();
  s.save();
  s.undo();
  s.undo();
  assert.deepEqual(seen, []);
});

test("cp65h one event per call, row-major, unchanged writes left out", () => {
  const s = createSheet();
  const seen = watched(s);
  s.setMany({ C3: "c", a1: "a", B2: "=A1", A3: "x" });
  s.setMany({ A1: "a", B2: "=A1" });
  s.set("Z9", "");
  s.set("A1", "a");
  s.setMany({ a1: "b", A1: "a" });
  s.setMany({ D4: "1", d4: "" });
  s.setMany({});
  assert.deepEqual(seen, [["A1", "B2", "A3", "C3"]]);
  s.setMany({ A3: "", C3: "c", A1: "z" });
  assert.deepEqual(seen.at(-1), ["A1", "A3"]);
  assert.equal(seen.length, 2);
});

test("cp65h insert, delete, undo and redo list every changed address", () => {
  const s = createSheet();
  s.setMany({ A1: "1", A2: "2", C5: "=A2" });
  const seen = watched(s);
  s.insertRows(1);
  assert.deepEqual(seen, [["A1", "A2", "A3", "C5", "C6"]]);
  s.undo();
  assert.deepEqual(seen.at(-1), ["A1", "A2", "A3", "C5", "C6"]);
  s.redo();
  s.deleteCols("B");
  assert.deepEqual(seen.at(-1), ["B6", "C6"]);
  s.insertRows(50);
  s.set("A1", "9");
  s.undo();
  assert.deepEqual(seen.at(-1), ["A1"]);
  assert.equal(seen.length, 6);
  assert.equal(s.undo(), true);
  assert.deepEqual(seen.at(-1), ["B6", "C6"]);
});

test("cp65h copy, fromCSV, fill, sort and replace each fire one event", () => {
  const s = createSheet();
  s.setMany({ A1: "3", A2: "1", A3: "2", B1: "=A1" });
  const seen = watched(s);
  s.copy("A1:B1", "D1");
  s.fromCSV("p,q\nr,s", "F1");
  s.fillDown("B1:B3");
  s.sort("A1:A3", "A");
  s.sort("A1:A3", "A");
  s.replace("q", "Q");
  s.replace("nothing", "x");
  s.copy("A1", "A1");
  assert.deepEqual(seen, [["D1", "E1"], ["F1", "G1", "F2", "G2"], ["B2", "B3"], ["A1", "A2", "A3"], ["G1"]]);
});

test("cp65h a cell written and changed back within one call is not listed", () => {
  const s = createSheet();
  s.setMany({ A1: "1", A2: "1", B1: "x" });
  const seen = watched(s);
  s.sort("A1:A2", "A", { descending: true });
  s.replace("x", "x");
  s.setMany({ b1: "y", B1: "x" });
  assert.deepEqual(seen, []);
  s.copy("A1:A2", "A2");
  assert.deepEqual(seen, [["A3"]]);
});

test("cp65h listeners run in the order they were added", () => {
  const s = createSheet();
  const log = [];
  s.onChange(() => log.push("first"));
  s.onChange(() => log.push("second"));
  s.onChange((e) => log.push(`third ${e.cells.join()} ${s.get("A1")}`));
  assert.equal(s.set("A1", "7"), undefined);
  assert.deepEqual(log, ["first", "second", "third A1 7"]);
});

test("cp65c chat: a listener that throws is ignored", () => {
  const s = createSheet();
  const log = [];
  s.onChange(() => log.push("first"));
  s.onChange(() => { log.push("bad"); throw new Error("boom"); });
  s.onChange((e) => log.push(`third ${e.cells.join()} ${s.get("A1")}`));
  assert.equal(s.set("A1", "7"), undefined);
  assert.deepEqual(log, ["first", "bad", "third A1 7"]);
  assert.equal(s.getInput("A1"), "7");
  assert.equal(s.undo(), true);
  assert.equal(s.undo(), false);
});

test("cp65h each listener gets its own event object", () => {
  const s = createSheet();
  const got = [];
  s.onChange((e) => { got.push(e); e.cells.push("ZZ1"); e.cells[0] = "x"; });
  s.onChange((e) => got.push(e));
  s.setMany({ A1: "1", B1: "2" });
  assert.notEqual(got[0], got[1]);
  assert.deepEqual(got[1], { cells: ["A1", "B1"] });
});

test("cp65h a listener's own change is delivered after the current event", () => {
  const s = createSheet();
  const log = [];
  s.onChange((e) => {
    log.push(`a ${e.cells.join()}`);
    if (e.cells.includes("A1")) s.set("B1", "=A1+1");
  });
  s.onChange((e) => log.push(`b ${e.cells.join()} ${s.getInput("B1")}`));
  s.set("A1", "1");
  assert.deepEqual(log, ["a A1", "b A1 =A1+1", "a B1", "b B1 =A1+1"]);
  assert.equal(s.get("B1"), 2);
});

test("cp65h listeners are those registered when the call finished", () => {
  const s = createSheet();
  const log = [];
  let offB = null;
  s.onChange(() => {
    log.push("a");
    if (!offB) offB = s.onChange(() => log.push("late"));
  });
  let offC = null;
  s.onChange(() => { log.push("d"); offC(); });
  offC = s.onChange(() => log.push("c"));
  s.set("A1", "1");
  assert.deepEqual(log, ["a", "d", "c"]);
  s.set("A1", "2");
  assert.deepEqual(log, ["a", "d", "c", "a", "d", "late"]);
});

test("cp65h calls that refuse fire nothing", () => {
  const s = createSheet();
  s.setValidation("A1:A3", { type: "list", items: ["a", "b"] });
  s.merge("C1:D1");
  const seen = watched(s);
  assert.throws(() => s.setMany({ B1: "1", A1: "zzz" }), thrown("#INVALID", "A1"));
  assert.throws(() => s.setMany({ B1: "1", Q0: "1" }), thrown("#ADDR", "Q0"));
  assert.throws(() => s.set("D1", "1"), thrown("#MERGE", "D1"));
  assert.throws(() => s.fromCSV("x\n\"", "B1"), thrown("#CSV", "2"));
  assert.deepEqual(seen, []);
  assert.equal(s.getInput("B1"), null);
});

test("cp65h renameSheet, deleteSheet and book.undo fire on the sheets they change", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  const x = b.addSheet("Extra");
  m.setMany({ A1: "=Data!A1", B2: "=Extra!A1", C3: "plain" });
  d.setMany({ A1: "1", B1: "=data!A1+Main!C3" });
  const ms = watched(m);
  const ds = watched(d);
  const xs = watched(x);
  b.renameSheet("DATA", "Facts");
  assert.deepEqual(ms, [["A1"]]);
  assert.deepEqual(ds, [["B1"]]);
  b.renameSheet("Facts", "Facts");
  b.deleteSheet("Extra");
  assert.deepEqual(ms, [["A1"], ["B2"]]);
  assert.equal(m.getInput("B2"), "=#REF!");
  assert.deepEqual(xs, []);
  d.set("C1", "c");
  m.set("D1", "d");
  b.undo();
  b.undo();
  assert.deepEqual(ms.at(-1), ["D1"]);
  assert.deepEqual(ds.at(-1), ["C1"]);
  assert.equal(ds.length, 3);
});

test("cp65h loaded sheets fire nothing for their inputs; a removed sheet keeps listeners", () => {
  const s = loadSheet('{"format":"sheet","version":1,"cells":{"A1":"1","B1":"=A1"},"names":{}}');
  const seen = watched(s);
  s.get("B1");
  assert.deepEqual(seen, []);
  s.set("A1", "2");
  assert.deepEqual(seen, [["A1"]]);
  const b = loadWorkbook('{"format":"workbook","version":2,"errorOrder":"priority","sheets":[{"name":"Main","cells":{"A1":"1"},"names":{}}]}');
  const m = b.sheet("Main");
  const ms = watched(m);
  b.addSheet("Data");
  assert.deepEqual(ms, []);
  b.removeSheet("Main");
  m.set("A2", "2");
  assert.deepEqual(ms, [["A2"]]);
});

test("cp65h CHANGES.md has a cp65 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 65);
  assert.match(lines[64], /^- cp65: \S/);
  assert.notEqual(lines[64].slice(8).toLowerCase(), "change events");
});
