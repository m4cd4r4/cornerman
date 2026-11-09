// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

const isErr = (v, code, cell) => v && typeof v === "object" && v.code === code && v.cell === cell && typeof v.message === "string" && v.message.length > 0;
function val(f, setup = {}) {
  const s = createSheet();
  for (const [k, v] of Object.entries(setup)) s.set(k, v);
  s.set("Z99", f);
  return s.get("Z99");
}

test("cp16h ROUND is half to even, not half away from zero", () => {
  const cases = [["2.5", 0, 2], ["3.5", 0, 4], ["-2.5", 0, -2], ["0.5", 0, 0], ["999.5", 0, 1000], ["25", -1, 20], ["35", -1, 40], ["5", -1, 0], ["-15", -1, -20], ["0.125", 2, 0.12], ["2.675", 2, 2.68]];
  for (const [x, d, want] of cases) assert.equal(val(`=ROUND(${x}, ${d})`), want, `${x} ${d}`);
});

test("cp16h rounding decides on the shortest decimal form", () => {
  assert.equal(val("=ROUND(1.005, 2)"), 1);
  assert.equal(val("=ROUND(0.285, 2)"), 0.28);
  assert.equal(val("=ROUNDUP(0.1+0.2, 1)"), 0.4);
  assert.equal(val("=ROUNDUP(0.1+0.2, 16-1)"), 0.300000000000001);
  assert.equal(val("=ROUNDDOWN(0.1+0.2, 15)"), 0.3);
  assert.equal(val("=ROUND(0.0000025, 6)"), 0.000002);
});

test("cp16h ROUNDUP goes away from zero, ROUNDDOWN toward zero", () => {
  assert.equal(val("=ROUNDUP(-1.01, 0)"), -2);
  assert.equal(val("=ROUNDUP(1.000001, 0)"), 2);
  assert.equal(val("=ROUNDUP(3, 0)"), 3);
  assert.equal(val("=ROUNDUP(1, -1)"), 10);
  assert.equal(val("=ROUNDDOWN(-1.99, 0)"), -1);
  assert.equal(val("=ROUNDDOWN(19, -1)"), 10);
  assert.equal(val("=ROUNDDOWN(1.99999, 4)"), 1.9999);
});

test("cp16h zero results are never -0", () => {
  for (const f of ["=ROUND(-0.4, 0)", "=ROUNDDOWN(-0.5, 0)", "=ROUND(-4, -1)", "=ROUND(-0.0001, 2)"]) {
    assert.ok(Object.is(val(f), 0), f);
  }
});

test("cp16h digits are truncated toward zero and limited to -15..15", () => {
  assert.equal(val("=ROUND(2.567, 1.9)"), 2.6);
  assert.equal(val("=ROUND(1250, -2.9)"), 1200);
  assert.equal(val("=ROUND(1350, -2.9)"), 1400);
  assert.equal(val("=ROUND(2.567, -0.5)"), 3);
  assert.equal(val("=ROUND(1.5, 15.9)"), 1.5);
  assert.equal(val("=ROUND(1, -15)"), 0);
  assert.ok(isErr(val("=ROUND(1, 16)"), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=ROUNDUP(1, -16)"), "#VALUE!", "Z99"));
});

test("cp16h arguments are values: exactly two, no ranges, no text", () => {
  assert.equal(val("=ROUND(A1, 0)"), 0);
  assert.equal(val("=ROUND(B1, A1)", { B1: "=TRUE" }), 1);
  assert.equal(val("=ROUND(B1, 0)", { B1: "2.5" }), 2);
  assert.ok(isErr(val('=ROUND("1", 0)'), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=ROUND(B1, 0)", { B1: "abc" }), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=ROUND(A1:A2, 0)"), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=ROUND(1)"), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=ROUND(1, 2, 3)"), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=ROUNDDOWN()"), "#VALUE!", "Z99"));
});

test("cp16h errors in arguments follow the priority order", () => {
  assert.ok(isErr(val("=ROUND(1/0, foo)"), "#NAME?", "Z99"));
  assert.ok(isErr(val("=ROUND(B1, 1)", { B1: "=1/0" }), "#DIV/0!", "B1"));
  assert.ok(isErr(val("=ROUND(1, A0)"), "#REF!", "Z99"));
});

test("cp16h names: a cell name is a value, a range name is #VALUE!", () => {
  const s = createSheet();
  s.set("A1", "2.25");
  s.defineName("p", "A1");
  s.defineName("r", "A1:A2");
  s.set("B1", "=ROUND(p, 1)");
  s.set("B2", "=ROUND(r, 1)");
  assert.equal(s.get("B1"), 2.2);
  assert.ok(isErr(s.get("B2"), "#VALUE!", "B2"));
  assert.equal(s.display("B1"), "2.2");
});
