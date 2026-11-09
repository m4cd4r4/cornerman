// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

function val(f) {
  const s = createSheet();
  s.set("A1", f);
  return s.get("A1");
}
const isErr = (v, code, cell) => v && typeof v === "object" && v.code === code && v.cell === cell && typeof v.message === "string" && v.message.length > 0;

test("cp02h power is right-associative and above unary minus", () => {
  assert.equal(val("=2^3^2"), 512);
  assert.equal(val("=-2^2"), -4);
  assert.equal(val("=(-2)^2"), 4);
  assert.equal(val("=2^-1"), 0.5);
  assert.equal(val("=-2^-2"), -0.25);
});

test("cp02h precedence and associativity", () => {
  assert.equal(val("=10-4-3"), 3);
  assert.equal(val("=24/4/2"), 3);
  assert.equal(val("=2*3^2"), 18);
  assert.equal(val("=--3"), 3);
  assert.equal(val("=+-+4"), -4);
  assert.equal(val("= 1 +\t2 "), 3);
  assert.equal(val("=1.5*2"), 3);
});

test("cp02h parse failures are stored #PARSE! values", () => {
  for (const f of ["=1+", "=(1", "=1)", "=1..2", "=1 2", "=", "=*2", "=2**3", "=.5"]) {
    const s = createSheet();
    s.set("C3", f);
    assert.ok(isErr(s.get("C3"), "#PARSE!", "C3"), f);
    assert.equal(s.getInput("C3"), f);
  }
});

test("cp02h getInput returns raw strings and null", () => {
  const s = createSheet();
  assert.equal(s.getInput("A1"), null);
  s.set("A1", "007");
  assert.equal(s.getInput("A1"), "007");
});

test("cp02h division by zero carries its cell", () => {
  const s = createSheet();
  s.set("d4", "=5/(2-2)");
  assert.ok(isErr(s.get("D4"), "#DIV/0!", "D4"));
});
