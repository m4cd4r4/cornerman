// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const isErr = (v, code, cell) => v && typeof v === "object" && v.code === code && v.cell === cell && typeof v.message === "string" && v.message.length > 0;
// Rows 1-10 of K hold one kind of value each; L holds powers of two, so a sum names its rows.
const DATA = {
  K1: "5", K2: '="5"', K3: "apple", K4: "APPLE", K6: '=""', K7: "=TRUE", K8: "=1/0", K9: "10", K10: "a*",
  L1: "1", L2: "2", L3: "4", L4: "8", L5: "16", L6: "32", L7: "64", L8: "128", L9: "256", L10: "512",
};
function sheet(setup = DATA) {
  const s = createSheet();
  for (const [k, v] of Object.entries(setup)) s.set(k, v);
  return s;
}
function val(f, setup = DATA) {
  const s = sheet(setup);
  s.set("Z99", f);
  return s.get("Z99");
}
const count = (crit) => val(`=COUNTIF(K1:K10, ${crit})`);

test("cp43h COUNTIF equality is type-strict, no wildcards", () => {
  assert.equal(count("5"), 1);
  assert.equal(count('"5"'), 1);
  assert.equal(count('"=5"'), 1);
  assert.equal(count('"5.0"'), 1);
  assert.equal(count("K2"), 1);
  assert.equal(count('"apple"'), 2);
  assert.equal(count('"=APPLE"'), 2);
  assert.equal(count("TRUE"), 1);
  assert.equal(count('"TRUE"'), 0);
  assert.equal(count('"a*"'), 1);
  assert.equal(count('"*"'), 0);
  assert.equal(count('"a?"'), 0);
});

test("cp43h COUNTIF blanks, <> and errors", () => {
  assert.equal(count('""'), 2);
  assert.equal(count('"="'), 2);
  assert.equal(count("B1"), 2);
  assert.equal(count('"<>"'), 7);
  assert.equal(count('"<>5"'), 8);
  assert.equal(count('"<>apple"'), 7);
  assert.equal(val('=COUNTIF(K8:K8, "<>1")'), 0);
  assert.ok(isErr(val("=COUNTIF(K8, K8)"), "#DIV/0!", "K8"));
});

test("cp43h COUNTIF ordering operators compare same-type values only", () => {
  assert.equal(count('">5"'), 1);
  assert.equal(count('">=5"'), 2);
  assert.equal(count('"<10"'), 1);
  assert.equal(count('">a"'), 3);
  assert.equal(count('"<b"'), 4);
  assert.equal(count('">"'), 0);
  assert.equal(count('">FALSE"'), 0);
  assert.equal(val("=COUNTIF(K7, FALSE)"), 0);
});

test("cp43h AVERAGEIF positions, skipped values, no numbers", () => {
  const avg = (crit) => val(`=AVERAGEIF(K1:K10, ${crit}, L1:L10)`);
  assert.equal(avg("5"), 1);
  assert.equal(avg('"apple"'), 6);
  assert.equal(avg('"<>5"'), 894 / 8);
  assert.equal(avg('""'), 24);
  assert.ok(isErr(avg('"zzz"'), "#DIV/0!", "Z99"));
  assert.equal(val('=AVERAGEIF(K1:K10, "<>5")'), 10);
  assert.equal(val('=AVERAGEIF(K1:K10, ">0")'), 7.5);
  assert.ok(isErr(val('=AVERAGEIF(K1:K10, "apple")'), "#DIV/0!", "Z99"));
  assert.ok(isErr(val("=AVERAGEIF(K1:K10, TRUE)"), "#DIV/0!", "Z99"));
});

test("cp43h AVERAGEIF errors in the average range count only where the row matches", () => {
  const setup = { K1: "1", K2: "2", K3: "3", L1: "=1/0", L2: "5", L3: "=FOO()", M1: "x", M2: "=TRUE", M3: "4" };
  assert.equal(val("=AVERAGEIF(K1:K3, 2, L1:L3)", setup), 5);
  assert.ok(isErr(val('=AVERAGEIF(K1:K3, ">1", L1:L3)', setup), "#NAME?", "L3"));
  assert.ok(isErr(val('=AVERAGEIF(K1:K3, "<3", L1:L3)', setup), "#DIV/0!", "L1"));
  assert.equal(val('=AVERAGEIF(K1:K3, ">0", M1:M3)', setup), 4);
  assert.ok(isErr(val('=AVERAGEIF(K1:K3, "<3", M1:M3)', setup), "#DIV/0!", "Z99"));
});

test("cp43h shapes and arguments", () => {
  const setup = { K1: "1", K2: "2", K3: "3", N5: "10", N6: "20", N7: "30" };
  assert.equal(val("=AVERAGEIF(K1:K3, 2, N5:N7)", setup), 20);
  assert.equal(val('=AVERAGEIF(K1:K3, ">1", N5:N7)', setup), 25);
  assert.ok(isErr(val("=AVERAGEIF(K1:K3, 1, N5:N6)", setup), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=AVERAGEIF(K1:K3, 1, N5:O7)", setup), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=AVERAGEIF(K1:K3, 1, N5)", setup), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=AVERAGEIF(K1:K3)", setup), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=AVERAGEIF(K1:K3, 1, N5:N7, 1)", setup), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=COUNTIF(K1:K3)", setup), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=COUNTIF(K1:K3, 1, K1:K3)", setup), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=COUNTIF(5, 5)", setup), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=COUNTIF(K1+1, 5)", setup), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=COUNTIF(K1:K3, 1/0)", setup), "#DIV/0!", "Z99"));
  assert.ok(isErr(val("=COUNTIF(K0:K3, 1/0)", setup), "#REF!", "Z99"));
  assert.ok(isErr(val("=COUNTIF(NOPE, 1/0)", setup), "#NAME?", "Z99"));
  assert.ok(isErr(val("=AVERAGEIF(K1:K3, 1/0, NOPE)", setup), "#NAME?", "Z99"));
  assert.ok(isErr(val("=COUNTIF(K1:K3, K1:K2)", setup), "#VALUE!", "Z99"));
  assert.equal(val("=COUNTIF(K1, 1)", setup), 1);
  assert.equal(val("=COUNTIF(Q1:Q4, \"\")", setup), 4);
});

test("cp43h values, not display text; names and precedents", () => {
  const s = createSheet();
  s.set("A1", "0.5");
  s.set("A2", "0.25");
  s.setFormat("A1:A2", "0%");
  s.set("B1", '=COUNTIF(A1:A2, 0.5)');
  s.set("B2", '=COUNTIF(A1:A2, "50%")');
  assert.equal(s.get("B1"), 1);
  assert.equal(s.get("B2"), 0);
  s.defineName("R", "A1:A2");
  s.set("B3", '=AVERAGEIF(R, "<1")');
  assert.equal(s.get("B3"), 0.375);
  assert.deepEqual(s.precedents("B3"), ["A1", "A2"]);
  s.set("C1", '=COUNTIF(C1:C3, 1)');
  assert.ok(isErr(s.get("C1"), "#CYCLE!", "C1"));
  s.set("C1", '=COUNTIF(D1:D3, ">0")');
  assert.deepEqual(s.precedents("C1"), ["D1", "D2", "D3"]);
  assert.equal(s.get("C1"), 0);
  s.set("D2", "3");
  assert.equal(s.get("C1"), 1);
});

test("cp43h insert and delete rewrite the ranges", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.set("A2", "2");
  s.set("A3", "3");
  s.set("B1", '=COUNTIF(A1:A3, ">1")');
  s.set("B2", '=AVERAGEIF(A1:A3, ">0", A1:A3)');
  s.insertRows(2, 1);
  s.set("A2", "9");
  assert.equal(s.getInput("B1"), '=COUNTIF(A1:A4, ">1")');
  assert.equal(s.get("B1"), 3);
  assert.equal(s.get("B3"), 15 / 4);
  s.deleteRows(3, 2);
  assert.equal(s.getInput("B1"), '=COUNTIF(A1:A2, ">1")');
  assert.equal(s.get("B1"), 1);
  s.set("D9", '=AVERAGEIF(A1:A2, ">0", A1:A2)');
  assert.equal(s.get("D9"), 5);
  s.deleteRows(1, 2);
  assert.equal(s.getInput("D7"), '=AVERAGEIF(#REF!, ">0", #REF!)');
});

test("cp43h ranges on another sheet", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.fromCSV("x,1\ny,2\nx,3", "A1");
  m.set("A1", '=COUNTIF(Data!A1:A3, "X")');
  m.set("A2", '=AVERAGEIF(Data!A1:A3, "x", Data!B1:B3)');
  m.set("A3", '=COUNTIF(Nope!A1:A3, "x")');
  assert.equal(m.get("A1"), 2);
  assert.equal(m.get("A2"), 2);
  assert.ok(isErr(m.get("A3"), "#REF!", "A3"));
  d.set("A2", "x");
  assert.equal(m.get("A1"), 3);
  assert.equal(m.get("A2"), 2);
  assert.deepEqual(m.precedents("A1"), ["Data!A1", "Data!A2", "Data!A3"]);
});

test("cp43h CHANGES.md has a cp43 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 43);
  assert.match(lines[42], /^- cp43: \S/);
  assert.notEqual(lines[42].slice(8).toLowerCase(), "countif and averageif");
});
