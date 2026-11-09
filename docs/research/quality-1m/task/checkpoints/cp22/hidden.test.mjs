// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

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
const sum = (crit) => val(`=SUMIF(K1:K10, ${crit}, L1:L10)`);

test("cp22h equality is type-strict", () => {
  assert.equal(sum("5"), 1);
  assert.equal(sum('"5"'), 1);
  assert.equal(sum('"=5"'), 1);
  assert.equal(sum('"5.0"'), 1);
  assert.equal(sum('" 5"'), 0);
  assert.equal(sum('"apple"'), 12);
  assert.equal(sum('"=APPLE"'), 12);
  assert.equal(sum("TRUE"), 64);
  assert.equal(sum('"TRUE"'), 0);
  // K2 holds the text "5": as a criterion that is the number 5, so it matches K1, not itself.
  assert.equal(sum("K2"), 1);
});

test("cp22h no wildcards", () => {
  assert.equal(sum('"a*"'), 512);
  assert.equal(sum('"a?"'), 0);
  assert.equal(sum('"*"'), 0);
});

test("cp22h blanks", () => {
  assert.equal(sum('""'), 48);
  assert.equal(sum('"="'), 48);
  assert.equal(sum("B1"), 48);
  assert.equal(sum('"<>"'), 847);
});

test("cp22h <> is the complement of =, errors excluded", () => {
  assert.equal(sum('"<>5"'), 894);
  assert.equal(sum('"<>apple"'), 1 + 2 + 16 + 32 + 64 + 256 + 512);
});

test("cp22h ordering operators compare same-type values only", () => {
  assert.equal(sum('">5"'), 256);
  assert.equal(sum('">=5"'), 257);
  assert.equal(sum('"<10"'), 1);
  assert.equal(sum('"<=10"'), 257);
  assert.equal(sum('">a"'), 4 + 8 + 512);
  assert.equal(sum('"<b"'), 2 + 4 + 8 + 512);
  assert.equal(sum('">"'), 0);
  assert.equal(sum('"<="'), 0);
});

test("cp22h without a sum range the range itself is added", () => {
  assert.equal(val('=SUMIF(K1:K10, ">0")'), 15);
  assert.equal(val("=SUMIF(K1:K10, TRUE)"), 0);
  assert.equal(val('=SUMIF(L1:L10, "<5")'), 7);
});

test("cp22h errors in the sum range count only where the row matches", () => {
  const setup = { K1: "1", K2: "2", K3: "3", L1: "=1/0", L2: "5", L3: "=FOO()", M1: "x", M2: "=TRUE", M3: "4" };
  assert.equal(val("=SUMIF(K1:K3, 2, L1:L3)", setup), 5);
  assert.ok(isErr(val('=SUMIF(K1:K3, ">1", L1:L3)', setup), "#NAME?", "L3"));
  assert.ok(isErr(val('=SUMIF(K1:K3, "<3", L1:L3)', setup), "#DIV/0!", "L1"));
  assert.equal(val('=SUMIF(K1:K3, ">0", M1:M3)', setup), 4);
  assert.equal(val("=SUMIF(K1:K3, 9, L1:L3)", setup), 0);
});

test("cp22h shapes and arguments", () => {
  const setup = { K1: "1", K2: "2", K3: "3", N5: "10", N6: "20", N7: "30" };
  assert.equal(val("=SUMIF(K1:K3, 2, N5:N7)", setup), 20);
  assert.ok(isErr(val("=SUMIF(K1:K3, 1, L1:L2)", setup), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=SUMIF(K1:K3, 1, L1:M3)", setup), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=SUMIF(5, 1)", setup), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=SUMIF(K1:K3)", setup), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=SUMIF(K1:K3, 1, L1:L3, 1)", setup), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=SUMIF(K1:K3, 1/0)", setup), "#DIV/0!", "Z99"));
  assert.ok(isErr(val("=SUMIF(K0:K3, 1)", setup), "#REF!", "Z99"));
  assert.ok(isErr(val("=SUMIF(K1:K3, 1/0, NOPE)", setup), "#NAME?", "Z99"));
  const s = sheet(setup);
  s.defineName("R", "K1:K3");
  s.set("Z99", '=SUMIF(R, ">1")');
  assert.equal(s.get("Z99"), 5);
  assert.deepEqual(s.precedents("Z99"), ["K1", "K2", "K3"]);
});
