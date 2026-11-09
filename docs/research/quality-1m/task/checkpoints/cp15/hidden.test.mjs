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
  s.set("A6", "4");
  s.set("C1", "=1/0");
  return s;
}
function val(s, f) {
  s.set("Z99", f);
  return s.get("Z99");
}

test("cp15h AVERAGE skips non-numbers in ranges and counts direct booleans", () => {
  const s = sheet();
  assert.equal(val(s, "=AVERAGE(A1:A6)"), 7 / 3);
  assert.equal(val(s, "=AVERAGE(A1:A6, TRUE)"), 2);
  assert.equal(val(s, "=AVERAGE(A4, A6)"), 4);
  assert.ok(isErr(val(s, '=AVERAGE(1, "x")'), "#VALUE!", "Z99"));
});

test("cp15h AVERAGE of nothing is #DIV/0!", () => {
  const s = sheet();
  assert.ok(isErr(val(s, "=AVERAGE(A3:A5)"), "#DIV/0!", "Z99"));
  assert.ok(isErr(val(s, "=AVERAGE()"), "#DIV/0!", "Z99"));
});

test("cp15h MIN and MAX", () => {
  const s = sheet();
  assert.equal(val(s, "=MIN(A1:A6)"), 1);
  assert.equal(val(s, "=MAX(A1:A6)"), 4);
  assert.equal(val(s, "=MIN(A1:A6, -3)"), -3);
  assert.equal(val(s, "=MAX(FALSE, -1)"), 0);
  assert.equal(val(s, "=MAX(A4, -1)"), -1);
  assert.ok(isErr(val(s, "=MIN(A1:A6, C1)"), "#DIV/0!", "C1"));
});

test("cp15h MIN and MAX of no numbers are #VALUE!, not 0", () => {
  const s = sheet();
  assert.ok(isErr(val(s, "=MIN(A3:A5)"), "#VALUE!", "Z99"));
  assert.ok(isErr(val(s, "=MAX()"), "#VALUE!", "Z99"));
  assert.ok(isErr(val(s, "=MAX(A5)"), "#VALUE!", "Z99"));
});

test("cp15h COUNT counts numbers only, never booleans, never text errors", () => {
  const s = sheet();
  assert.equal(val(s, "=COUNT(A1:A6)"), 3);
  assert.equal(val(s, "=COUNT(TRUE, FALSE, 1)"), 1);
  assert.equal(val(s, '=COUNT("x", 2, A1+1)'), 2);
  assert.equal(val(s, "=COUNT()"), 0);
});

test("cp15h COUNT skips error values", () => {
  const s = sheet();
  assert.equal(val(s, "=COUNT(C1, 1/0, A1:C1)"), 1);
  assert.equal(val(s, "=COUNT(nope+1, 5)"), 1);
});

test("cp15h COUNT errors only on the arguments themselves", () => {
  const s = sheet();
  assert.ok(isErr(val(s, "=COUNT(A0:A3)"), "#REF!", "Z99"));
  assert.ok(isErr(val(s, "=COUNT(A1:J1001)"), "#REF!", "Z99"));
  assert.ok(isErr(val(s, "=COUNT(nope, 1)"), "#NAME?", "Z99"));
  s.defineName("nums", "A1:A2");
  assert.equal(val(s, "=COUNT(nums)"), 2);
});

test("cp15h the functions recalculate through ranges and names", () => {
  const s = sheet();
  s.defineName("col", "A1:A9");
  s.set("D1", "=AVERAGE(col)+COUNT(col)");
  assert.equal(s.get("D1"), 7 / 3 + 3);
  s.set("A9", "5");
  assert.equal(s.get("D1"), 3 + 4);
});
