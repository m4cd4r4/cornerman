// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

const isErr = (v, code, cell) => v && typeof v === "object" && v.code === code && v.cell === cell && typeof v.message === "string" && v.message.length > 0;
function sheet() {
  const s = createSheet();
  s.set("A1", "1");
  s.set("A2", "2");
  s.set("A3", "hello");
  s.set("A4", "=TRUE");
  s.set("B1", "10");
  return s;
}
function val(s, f) {
  s.set("Z99", f);
  return s.get("Z99");
}

test("cp13h range arguments skip text, booleans and empty cells", () => {
  const s = sheet();
  assert.equal(val(s, "=SUM(A1:A5)"), 3);
  assert.equal(val(s, "=sum(b1:a4)"), 13);
  assert.equal(val(s, "=SUM(A4)"), 0);
  assert.equal(val(s, "=SUM(A3)"), 0);
});

test("cp13h direct arguments: booleans count, text is #VALUE! even when numeric", () => {
  const s = sheet();
  assert.equal(val(s, "=SUM(A4+0, TRUE, 2)"), 4);
  assert.ok(isErr(val(s, '=SUM(1, "2")'), "#VALUE!", "Z99"));
  assert.ok(isErr(val(s, "=SUM(A3&\"\")"), "#VALUE!", "Z99"));
  assert.equal(val(s, "=SUM()"), 0);
  assert.equal(val(s, "=SUM(A1:A2, 5, A1:A2)"), 11);
});

test("cp13h errors in ranges and arguments follow the priority order", () => {
  const s = sheet();
  s.set("C1", "=1/0");
  s.set("C2", "=foo");
  assert.ok(isErr(val(s, "=SUM(C1:C2)"), "#NAME?", "C2"));
  assert.ok(isErr(val(s, "=SUM(C1, 1/0)"), "#DIV/0!", "C1"));
  assert.ok(isErr(val(s, "=SUM(C1:C2, A0)"), "#REF!", "Z99"));
});

test("cp13h bad and over-size ranges are #REF!", () => {
  const s = sheet();
  assert.ok(isErr(val(s, "=SUM(A0:A3)"), "#REF!", "Z99"));
  assert.ok(isErr(val(s, "=SUM(A1:J1001)"), "#REF!", "Z99"));
  assert.equal(val(s, "=SUM(A1:J1000)"), 13);
  assert.ok(isErr(val(s, "=A0:A2"), "#REF!", "Z99"));
});

test("cp13h ranges are values only inside functions", () => {
  const s = sheet();
  assert.ok(isErr(val(s, "=A1:A2+1"), "#VALUE!", "Z99"));
  assert.ok(isErr(val(s, "=-A1:A2"), "#VALUE!", "Z99"));
  assert.equal(val(s, "=SUM(A1:A2)*2"), 6);
});

test("cp13h call syntax", () => {
  const s = sheet();
  assert.ok(isErr(val(s, "=LOG10(1)"), "#NAME?", "Z99"));
  assert.ok(isErr(val(s, "=NOPE(1/0)"), "#NAME?", "Z99"));
  assert.ok(isErr(val(s, "=A0+NOPE()"), "#REF!", "Z99"));
  for (const f of ["=SUM(1,,2)", "=SUM(1,)", "=SUM(1", "=SUM(A1:)", "=_X(1)"]) {
    assert.ok(isErr(val(s, f), "#PARSE!", "Z99"), f);
  }
  assert.equal(val(s, "=SUM( 1 , 2 )+Sum(3)"), 6);
});

test("cp13h every cell of a range is referred to", () => {
  const s = sheet();
  s.set("C5", "=SUM(A1:B2)");
  assert.deepEqual(s.precedents("C5"), ["A1", "B1", "A2", "B2"]);
  assert.deepEqual(s.dependents("B2"), ["C5"]);
  s.set("A2", "=SUM(A1:A3)");
  assert.ok(isErr(s.get("A2"), "#CYCLE!", "A2"));
  s.set("C6", "=SUM(A1:J1000)");
  assert.equal(s.precedents("C6").length, 10000);
  s.set("C7", "=SUM(A1:J1001)");
  assert.deepEqual(s.precedents("C7"), []);
});

test("cp13h editing a cell inside a range updates the sum", () => {
  const s = sheet();
  s.set("C1", "=SUM(A1:A9)");
  assert.equal(s.get("C1"), 3);
  s.set("A9", "4");
  assert.equal(s.get("C1"), 7);
});
