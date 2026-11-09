// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

const isErr = (v, code, cell) => v && typeof v === "object" && v.code === code && v.cell === cell && typeof v.message === "string" && v.message.length > 0;
function sheet() {
  const s = createSheet();
  s.set("A1", "2");
  s.set("A2", "3");
  s.set("A3", "word");
  s.set("B1", "10");
  return s;
}

test("cp14h names() is upper case, sorted, with ranges top-left first", () => {
  const s = sheet();
  s.defineName("zeta", "b3:a1");
  s.defineName("Alpha", "c2");
  s.defineName("_m", "B2:B2");
  assert.deepEqual(Object.keys(s.names()), ["ALPHA", "ZETA", "_M"]);
  assert.deepEqual(s.names(), { ALPHA: "C2", ZETA: "A1:B3", _M: "B2:B2" });
  s.defineName("ZETA", "A2");
  assert.equal(s.names().ZETA, "A2");
});

test("cp14h name validity", () => {
  const s = sheet();
  for (const bad of ["A1", "TAX2024", "ABC12", "TRUE", "false", "1x", "a-b", "", "a b", "x.y"]) {
    assert.throws(() => s.defineName(bad, "A1"), (e) => e.code === "#BADNAME" && e.cell === bad && e.message.length > 0, bad);
  }
  for (const good of ["TAX_2024", "T2X", "_x", "SUM", "a1b"]) s.defineName(good, "A1");
  assert.equal(Object.keys(s.names()).length, 5);
});

test("cp14h invalid targets throw #ADDR with the ref as passed", () => {
  const s = sheet();
  for (const bad of ["A0", "A1:B", "A1:B2:C3", "A1:J1001", " A1", "=A1", "A1 :B2"]) {
    assert.throws(() => s.defineName("n", bad), (e) => e.code === "#ADDR" && e.cell === bad, bad);
  }
  s.defineName("n", "A1:J1000");
  assert.deepEqual(s.names(), { N: "A1:J1000" });
});

test("cp14h names in formulas are case-insensitive and may shadow function names", () => {
  const s = sheet();
  s.defineName("Rate", "A1");
  s.defineName("SUM", "B1");
  s.set("C1", "=RATE+rate*SUM+SUM(1)");
  assert.equal(s.get("C1"), 23);
});

test("cp14h range names are values only inside functions, even one-cell ranges", () => {
  const s = sheet();
  s.defineName("v", "A1:A2");
  s.defineName("one", "A1:A1");
  s.defineName("cellname", "A1");
  s.set("C1", "=v+1");
  assert.ok(isErr(s.get("C1"), "#VALUE!", "C1"));
  s.set("C2", "=one*2");
  assert.ok(isErr(s.get("C2"), "#VALUE!", "C2"));
  s.set("C3", "=cellname*2+SUM(one)");
  assert.equal(s.get("C3"), 6);
});

test("cp14h a cell name as a function argument is a range argument", () => {
  const s = sheet();
  s.defineName("t", "A3");
  s.set("C1", "=SUM(t, 1)");
  assert.equal(s.get("C1"), 1);
  s.set("C2", "=SUM(t&\"\", 1)");
  assert.ok(isErr(s.get("C2"), "#VALUE!", "C2"));
  s.set("C3", "=t+1");
  assert.ok(isErr(s.get("C3"), "#VALUE!", "C3"));
});

test("cp14h define, redefine and remove change values", () => {
  const s = sheet();
  s.set("C1", "=k*2");
  assert.ok(isErr(s.get("C1"), "#NAME?", "C1"));
  s.defineName("k", "A2");
  assert.equal(s.get("C1"), 6);
  s.defineName("k", "B1");
  assert.equal(s.get("C1"), 20);
  assert.equal(s.removeName("K"), true);
  assert.ok(isErr(s.get("C1"), "#NAME?", "C1"));
  assert.equal(s.removeName("k"), false);
  assert.deepEqual(s.names(), {});
});

test("cp14h names count as references for graph, cycles and incremental recalc", () => {
  const s = sheet();
  s.defineName("box", "A1:B1");
  s.set("C1", "=SUM(box)");
  s.set("C2", "=C1+1");
  s.set("C3", "=A2*1");
  assert.deepEqual(s.precedents("C1"), ["A1", "B1"]);
  assert.deepEqual(s.dependents("B1"), ["C1"]);
  for (const c of ["C1", "C2", "C3"]) s.get(c);
  const n = s.stats().evaluations;
  s.defineName("box", "A1:A2");
  assert.equal(s.get("C2"), 6);
  assert.equal(s.get("C3"), 3);
  assert.equal(s.stats().evaluations - n, 2);
  assert.deepEqual(s.dependents("B1"), []);
  s.defineName("box", "C2");
  assert.ok(isErr(s.get("C1"), "#CYCLE!", "C1"));
  assert.ok(isErr(s.get("C2"), "#CYCLE!", "C2"));
  s.removeName("box");
  assert.ok(isErr(s.get("C2"), "#NAME?", "C1"));
});
