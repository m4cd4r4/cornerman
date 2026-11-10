// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
const err = (v) => (v && typeof v === "object" ? `${v.code}@${v.cell}` : v);
function book() {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.fromCSV("1\n2\n3", "A1");
  m.set("A1", "=SUM(Data!A1:A3)");
  return { b, m, d };
}
const fail = (b, fn) => {
  const boom = { why: "test" };
  assert.throws(() => b.batch((x) => { fn(x); throw boom; }), (e) => e === boom);
};

test("cp66h fn gets the book, its result is returned, any thrown value comes back as is", () => {
  const { b } = book();
  let got = null;
  assert.equal(b.batch((x) => { got = x; }), undefined);
  assert.equal(got, b);
  assert.deepEqual(b.batch(() => [1, 2]), [1, 2]);
  assert.throws(() => b.batch(() => { throw "plain text"; }), (e) => e === "plain text");
  const e1 = new TypeError("t");
  assert.throws(() => b.batch(() => { throw e1; }), (e) => e === e1);
});

test("cp66h reads inside fn see every change at once", () => {
  const { b, m, d } = book();
  b.batch(() => {
    d.set("A1", "10");
    assert.equal(m.get("A1"), 15);
    m.set("B1", "=A1+Data!A2");
    assert.deepEqual(m.precedents("B1"), ["A1", "Data!A2"]);
    assert.equal(m.display("B1"), "17");
  });
  assert.equal(m.get("B1"), 17);
});

test("cp66h a batch is not one undo step", () => {
  const { b, m } = book();
  b.batch(() => {
    m.set("B1", "1");
    m.set("B2", "2");
    m.set("B3", "3");
  });
  assert.equal(b.undo(), true);
  assert.equal(m.getInput("B3"), null);
  assert.equal(m.getInput("B2"), "2");
  assert.equal(m.undo(), true);
  assert.equal(m.getInput("B2"), null);
  assert.equal(m.getInput("B1"), "1");
});

test("cp66h rollback restores inputs, layers and names of every sheet", () => {
  const { b, m, d } = book();
  m.setFormat("A1", "0.00");
  m.setNote("A1", "total");
  d.setValidation("B1", { type: "whole", min: 1, max: 9 });
  d.merge("C1:D1");
  d.hideRows(3);
  m.defineName("ALL", "A1:A2");
  b.defineConstant("K", 2);
  m.set("A2", "=SUBTOTAL(9, Data!A1:A3)*K");
  assert.equal(m.get("A2"), 6);
  const before = b.save();
  fail(b, () => {
    d.set("A1", "100");
    d.insertRows(1);
    m.setFormat("A1", null);
    m.setNote("A1", "");
    d.setValidation("B1", null);
    d.unmerge("C1");
    d.merge("E1:F2");
    d.showRows(3);
    d.hideRows(1, 2);
    m.defineName("ALL", "B1");
    m.removeName("ALL");
    b.defineConstant("K", 5);
    b.defineName("NEW", "Data!A1");
    d.sort("A1:A4", "A", { descending: true });
    m.fillDown("A1:A5");
  });
  assert.equal(b.save(), before);
  assert.equal(m.get("A1"), 6);
  assert.equal(m.display("A1"), "6.00");
  assert.equal(m.get("A2"), 6);
  assert.equal(m.getNote("A1"), "total");
  assert.deepEqual(d.getValidation("B1"), { type: "whole", min: 1, max: 9 });
  assert.deepEqual(d.merges(), ["C1:D1"]);
  assert.deepEqual(d.hiddenRows(), [3]);
  assert.deepEqual(m.names(), { ALL: "A1:A2" });
  assert.deepEqual(b.names(), { K: "=2" });
  assert.deepEqual(m.precedents("A1"), ["Data!A1", "Data!A2", "Data!A3"]);
  assert.deepEqual(d.dependents("A1"), ["Main!A1", "Main!A2"]);
});

test("cp66h rollback restores every undo and redo list", () => {
  const { b, m, d } = book();
  m.set("B1", "m1");
  d.set("B1", "d1");
  b.defineConstant("K", 1);
  m.set("B2", "m2");
  m.undo();
  fail(b, () => {
    m.set("C1", "x");
    d.undo();
    b.undo();
    m.set("C2", "y");
    b.removeName("K");
  });
  assert.equal(m.getInput("C1"), null);
  assert.equal(d.getInput("B1"), "d1");
  assert.equal(m.redo(), true);
  assert.equal(m.getInput("B2"), "m2");
  assert.equal(m.undo(), true);
  assert.equal(b.undo(), true);
  assert.deepEqual(b.names(), {});
  assert.equal(b.undo(), true);
  assert.equal(d.getInput("B1"), null);
  assert.equal(b.undo(), true);
  assert.equal(m.getInput("B1"), null);
  assert.equal(b.redo(), true);
  assert.equal(m.getInput("B1"), "m1");
});

test("cp66h sheet-list methods and nested batches throw #BATCH", () => {
  const { b, m } = book();
  const other = createWorkbook();
  other.addSheet("O");
  for (const [k, call] of [["addSheet", (x) => x.addSheet("New")], ["removeSheet", (x) => x.removeSheet("Data")], ["renameSheet", (x) => x.renameSheet("Data", "D2")], ["deleteSheet", (x) => x.deleteSheet("Data")], ["batch", (x) => x.batch(() => 1)], ["batch", (x) => x.batch(5)]]) {
    assert.throws(() => b.batch((x) => { m.set("Z1", "z"); call(x); }), thrown("#BATCH", k), k);
    assert.equal(m.getInput("Z1"), null);
  }
  assert.deepEqual(b.sheetNames(), ["Main", "Data"]);
  let code = null;
  b.batch((x) => {
    try { x.addSheet("New"); } catch (e) { code = e.code; }
    m.set("Z2", "kept");
    other.batch((o) => o.sheet("O").set("A1", "1"));
  });
  assert.equal(code, "#BATCH");
  assert.equal(m.getInput("Z2"), "kept");
  assert.equal(other.sheet("O").getInput("A1"), "1");
  b.addSheet("New");
  assert.deepEqual(b.sheetNames(), ["Main", "Data", "New"]);
  for (const v of [null, undefined, 5, "f", {}]) assert.throws(() => b.batch(v), thrown("#ARG", String(v)));
});

test("cp66h an error fn catches rolls nothing back", () => {
  const { b, m, d } = book();
  d.setValidation("B1", { type: "list", items: ["a"] });
  b.batch(() => {
    m.set("B1", "1");
    try { d.set("B1", "nope"); } catch { m.set("B2", "2"); }
    try { m.set("A0", "x"); } catch { /* ignored */ }
  });
  assert.equal(m.getInput("B1"), "1");
  assert.equal(m.getInput("B2"), "2");
});

test("cp66h events wait for the end; a rolled-back batch fires none", () => {
  const { b, m, d } = book();
  const log = [];
  m.onChange((e) => log.push(`Main ${e.cells.join()}`));
  d.onChange((e) => log.push(`Data ${e.cells.join()}`));
  b.batch(() => {
    d.set("B1", "1");
    m.set("C1", "x");
    m.set("B1", "y");
    d.set("A1", "9");
    m.set("C1", "");
    assert.deepEqual(log, []);
  });
  assert.deepEqual(log, ["Data A1,B1", "Main B1"]);
  fail(b, () => { m.set("D1", "1"); d.insertRows(1); });
  assert.deepEqual(log, ["Data A1,B1", "Main B1"]);
});

test("cp66h sheets outside the workbook are not rolled back", () => {
  const { b, m } = book();
  const lone = createSheet();
  const other = createWorkbook();
  const o = other.addSheet("O");
  const gone = b.addSheet("Gone");
  b.removeSheet("Gone");
  const log = [];
  lone.onChange((e) => log.push(e.cells.join()));
  fail(b, () => {
    lone.set("A1", "1");
    assert.deepEqual(log, []);
    o.set("A1", "2");
    gone.set("A1", "3");
    m.set("A3", "4");
  });
  assert.equal(lone.getInput("A1"), "1");
  assert.equal(o.getInput("A1"), "2");
  assert.equal(gone.getInput("A1"), "3");
  assert.equal(m.getInput("A3"), null);
  assert.deepEqual(log, ["A1"]);
  assert.equal(lone.undo(), true);
});

test("cp66h a rolled-back workbook name change is felt by its formulas", () => {
  const { b, m, d } = book();
  b.defineName("TOP", "Data!A1");
  m.set("B1", "=TOP*2");
  assert.equal(m.get("B1"), 2);
  fail(b, () => {
    b.defineName("TOP", "Data!A3");
    assert.equal(m.get("B1"), 6);
    d.set("A1", "50");
  });
  assert.equal(m.get("B1"), 2);
  d.set("A1", "4");
  assert.equal(m.get("B1"), 8);
});

test("cp66h CHANGES.md has a cp66 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 66);
  assert.match(lines[65], /^- cp66: \S/);
  assert.notEqual(lines[65].slice(8).toLowerCase(), "batches with rollback");
});
