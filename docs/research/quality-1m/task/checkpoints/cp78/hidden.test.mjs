// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook, loadSheet, loadWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;

test("cp78h checks in order, each changing nothing", () => {
  const b = createWorkbook();
  const s = b.addSheet("Main");
  s.defineName("A_", "B1");
  s.defineConstant("K", 1);
  b.defineConstant("SHARED", 2);
  s.setCell("C1", "=K+A_");
  for (const [o, n, cell] of [["nope", "1x", "nope"], [null, "X", "null"], ["SHARED", "X", "SHARED"], ["k", "A1", "A1"], ["k", "true", "true"], ["k", "1x", "1x"], ["k", null, "null"], ["k", "a_", "a_"], ["K", "A_", "A_"]]) {
    assert.throws(() => s.renameName(o, n), thrown("#BADNAME", cell), `${o} ${n}`);
  }
  b.defineConstant("OTHER", 3);
  assert.throws(() => b.renameName("K", "Z"), thrown("#BADNAME", "K"));
  assert.throws(() => b.renameName("shared", "other"), thrown("#BADNAME", "other"));
  assert.throws(() => b.renameName("shared", "B2"), thrown("#BADNAME", "B2"));
  assert.deepEqual(s.names(), { A_: "B1", K: "=1" });
  assert.deepEqual(b.names(), { OTHER: "=3", SHARED: "=2" });
  assert.equal(s.formula("C1"), "=K+A_");
  assert.deepEqual(s.undoList(), ["setCell", "defineConstant", "defineName"]);
});

test("cp78h a rename that only changes case does nothing at all", () => {
  const b = createWorkbook();
  const s = b.addSheet("Main");
  s.defineConstant("rate", 2);
  b.defineConstant("k", 1);
  s.setMany({ A1: "=rate*K", A2: "=RATE" });
  assert.equal(s.renameName("RATE", "Rate"), 0);
  assert.equal(b.renameName("k", "K"), 0);
  assert.equal(s.formula("A1"), "=rate*K");
  assert.equal(s.formula("A2"), "=RATE");
  assert.deepEqual(s.undoList(), ["setMany", "defineConstant"]);
  assert.equal(b.undoList().length, 3);
  assert.deepEqual(s.names(), { RATE: "=2" });
});

test("cp78h LET: its own names and the uses they hide are not touched", () => {
  const s = createSheet();
  s.set("A1", "4");
  s.defineConstant("rate", 2);
  s.setMany({
    B1: "=LET(rate, 3, rate) + rate",
    B2: "=LET(x, RATE, x * rate)",
    B3: "=LET(rate, rate + 1, rate)",
    B4: "=LET(x, 1, LET(rate, x, rate) + rate)",
    B5: "=LET(rate, 2)",
    B6: "=LET(Rate, 1, y, rAte, y)",
  });
  assert.equal(s.renameName("rate", "Fee"), 5);
  assert.equal(s.formula("B1"), "=LET(rate, 3, rate) + Fee");
  assert.equal(s.formula("B2"), "=LET(x, Fee, x * Fee)");
  assert.equal(s.formula("B3"), "=LET(rate, Fee + 1, rate)");
  assert.equal(s.formula("B4"), "=LET(x, 1, LET(rate, x, rate) + Fee)");
  assert.equal(s.formula("B5"), "=LET(Fee, 2)");
  assert.equal(s.formula("B6"), "=LET(Rate, 1, y, rAte, y)");
  assert.deepEqual([s.value("B1"), s.value("B2"), s.value("B3"), s.value("B4")], [5, 4, 3, 3]);
});

test("cp78h strings, functions, sheet names and broken formulas are never rewritten", () => {
  const b = createWorkbook();
  const s = b.addSheet("Main");
  const r = b.addSheet("Rate");
  r.setCell("A1", "10");
  s.defineConstant("rate", 2);
  s.defineName("sum", "D1");
  s.setMany({ D1: "7", A1: '="rate"&rate', A2: "=Rate!A1+RATE", A3: "=rate+", A4: "rate", A5: "=SUM(D1)+sum", A6: "=rate1+rate", A7: "=RATE!$A$1" });
  assert.equal(s.renameName("RATE", "Fee"), 2);
  assert.equal(s.formula("A1"), '="rate"&Fee');
  assert.equal(s.formula("A2"), "=Rate!A1+Fee");
  assert.equal(s.formula("A3"), "=rate+");
  assert.equal(s.formula("A4"), "rate");
  assert.equal(s.formula("A6"), "=rate1+rate");
  assert.equal(s.formula("A7"), "=RATE!$A$1");
  assert.equal(s.value("A2"), 12);
  assert.equal(s.renameName("sum", "Total"), 1);
  assert.equal(s.formula("A5"), "=SUM(D1)+Total");
  assert.equal(s.value("A5"), 14);
});

test("cp78h a formula that named the new name now uses the renamed one", () => {
  const s = createSheet();
  s.setMany({ A1: "3", B1: "=SPAN*2", B2: "=SUM(SPAN)" });
  s.defineName("old_", "A1:A2");
  s.set("A2", "4");
  assert.equal(s.value("B2").code, "#NAME?");
  assert.equal(s.renameName("old_", "span"), 0);
  assert.equal(s.value("B2"), 7);
  assert.equal(s.value("B1").code, "#VALUE!");
  assert.deepEqual(s.precedents("B2"), ["A1", "A2"]);
  assert.deepEqual(s.names(), { SPAN: "A1:A2" });
});

test("cp78h sheet.renameName is one undo step labelled renameName", () => {
  const s = createSheet();
  s.setCell("A1", "2");
  s.defineName("base", "A1");
  s.setMany({ B1: "=BASE*3", B2: "=base" });
  assert.equal(s.renameName("Base", "Root"), 2);
  assert.deepEqual(s.undoList(), ["renameName", "setMany", "defineName", "setCell"]);
  assert.equal(s.undo(), true);
  assert.equal(s.formula("B1"), "=BASE*3");
  assert.equal(s.formula("B2"), "=base");
  assert.deepEqual(s.names(), { BASE: "A1" });
  assert.equal(s.value("B1"), 6);
  assert.equal(s.redo(), true);
  assert.equal(s.formula("B1"), "=Root*3");
  assert.deepEqual(s.names(), { ROOT: "A1" });
  s.setCell("A1", "5");
  assert.equal(s.value("B2"), 5);
  s.defineConstant("noone", 1);
  assert.equal(s.renameName("noone", "Someone"), 0);
  assert.deepEqual(s.undoList().slice(0, 2), ["renameName", "defineConstant"]);
  s.undo();
  assert.deepEqual(s.names(), { NOONE: "=1", ROOT: "A1" });
});

test("cp78h rewrites are not checked: protection and limits", () => {
  const s = createSheet();
  s.defineConstant("k", 1);
  const long = "=" + "k+".repeat(498) + "1";
  assert.equal(long.length, 998);
  s.setMany({ A1: "=k", A2: long, A3: "=k*2" });
  s.protect("A1");
  assert.equal(s.renameName("K", "Kappa"), 3);
  assert.equal(s.formula("A1"), "=Kappa");
  assert.equal(s.formula("A2").length, 998 + 4 * 498);
  assert.equal(s.formula("A3"), "=Kappa*2");
  assert.equal(s.value("A2"), 499);
  s.setCell("A1", "=Kappa");
  assert.throws(() => s.setCell("A1", "=K"), thrown("#LOCKED", "A1"));
  assert.equal(s.formula("A1"), "=Kappa");
});

test("cp78h one change event per sheet for the rewritten cells", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  b.defineConstant("K", 1);
  m.setMany({ B2: "=K", A1: "=K+1", C1: "x" });
  d.setCell("A1", "=K");
  const seen = [];
  m.onChange((e) => seen.push(["Main", e.cells]));
  d.onChange((e) => seen.push(["Data", e.cells]));
  assert.equal(b.renameName("K", "Q"), 3);
  assert.deepEqual(seen, [["Main", ["A1", "B2"]], ["Data", ["A1"]]]);
  m.defineConstant("L", 2);
  m.renameName("L", "M");
  assert.equal(seen.length, 2);
});

test("cp78h book.renameName skips sheets whose own name hides it, and clears every undo list", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  const o = b.addSheet("Own");
  b.defineConstant("K", 1);
  o.defineConstant("K", 100);
  d.defineConstant("NEWK", 50);
  m.setCell("A1", "=K");
  d.setCell("A1", "=K");
  o.setCell("A1", "=K");
  m.undo();
  assert.equal(b.renameName("k", "NewK"), 1);
  assert.equal(m.formula("A1"), "");
  assert.equal(d.formula("A1"), "=NewK");
  assert.equal(o.formula("A1"), "=K");
  assert.equal(d.value("A1"), 50);
  assert.equal(o.value("A1"), 100);
  assert.deepEqual(b.names(), { NEWK: "=1" });
  for (const x of [m, d, o]) {
    assert.deepEqual(x.undoList(), []);
    assert.deepEqual(x.redoList(), []);
  }
  assert.deepEqual(b.undoList(), []);
  m.setCell("A2", "=newk*2");
  assert.equal(m.value("A2"), 2);
  b.defineConstant("Spare", 0);
  assert.equal(b.renameName("Spare", "Unused"), 0);
  assert.deepEqual(b.undoList(), []);
});

test("cp78h workbook range names: precedents and values follow; saved under the new name", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.setMany({ A1: "1", A2: "2" });
  b.defineName("cells", "Data!A1:A2");
  m.setCell("A1", "=SUM(cells)");
  assert.equal(b.renameName("CELLS", "Block"), 1);
  assert.equal(m.formula("A1"), "=SUM(Block)");
  assert.deepEqual(m.precedents("A1"), ["Data!A1", "Data!A2"]);
  d.setCell("A2", "5");
  assert.equal(m.value("A1"), 6);
  const text = b.save();
  assert.ok(text.includes('"names":{"BLOCK":"Data!A1:A2"}'));
  assert.equal(loadWorkbook(text).get("Main").value("A1"), 6);
  const s = createSheet();
  s.setCell("A1", "2");
  s.defineName("one", "A1");
  s.setCell("B1", "=one");
  s.renameName("one", "Uno");
  assert.equal(s.save(), '{"format":"sheet","version":1,"cells":{"A1":"2","B1":"=Uno"},"names":{"UNO":"A1"}}');
  assert.equal(loadSheet(s.save()).value("B1"), 2);
});

test("cp78h a batch that throws puts a book rename back", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  b.defineConstant("K", 3);
  m.setCell("A1", "=K*2");
  assert.throws(() => b.batch(() => { b.renameName("K", "J"); throw new Error("undo it"); }), /undo it/);
  assert.deepEqual(b.names(), { K: "=3" });
  assert.equal(m.formula("A1"), "=K*2");
  assert.equal(m.value("A1"), 6);
  assert.deepEqual(m.undoList(), ["setCell"]);
  assert.equal(b.batch(() => b.renameName("K", "J")), 1);
  assert.equal(m.formula("A1"), "=J*2");
});

test("cp78h CHANGES.md has a cp78 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 78);
  assert.match(lines[77], /^- cp78: \S/);
  assert.notEqual(lines[77].slice(8).toLowerCase(), "renaming names");
});
