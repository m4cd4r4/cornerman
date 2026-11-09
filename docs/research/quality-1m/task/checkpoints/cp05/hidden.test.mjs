// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

function show(f) {
  const s = createSheet();
  s.set("A1", f);
  return s.display("A1");
}

test("cp05h half-even at 6 places, on the shortest decimal form", () => {
  assert.equal(show("=0.0000025"), "0.000002");
  assert.equal(show("=0.0000035"), "0.000004");
  assert.equal(show("=0.0000045"), "0.000004");
  assert.equal(show("=0.00000251"), "0.000003");
  assert.equal(show("=1.0000005"), "1");
  assert.equal(show("=1.0000015"), "1.000002");
  assert.equal(show("=0.9999995"), "1");
  assert.equal(show("=9.9999999"), "10");
});

test("cp05h uses String(x) digits, not binary", () => {
  // 1.0000025 is 1.00000249999... in binary; String gives 1.0000025.
  assert.equal(show("=1.0000025"), "1.000002");
  assert.equal(show("=2.5000035"), "2.500004");
});

test("cp05h no exponent form, no -0", () => {
  assert.equal(show("=2.5/10000000"), "0");
  assert.equal(show("=7/10000000"), "0.000001");
  assert.equal(show("=-1/10000000"), "0");
  assert.equal(show("=0*-1"), "0");
  assert.equal(show("=123456789012345/1"), "123456789012345");
  assert.equal(show("=-0.0000004"), "0");
  assert.equal(show("=-0.0000006"), "-0.000001");
});

test("cp05h trailing zeros and points removed", () => {
  assert.equal(show("=1.5*2"), "3");
  assert.equal(show("=0.1+0.2"), "0.3");
  assert.equal(show("=10/4"), "2.5");
  assert.equal(show("10.50"), "10.5");
});

test("cp05h huge values show ten hashes", () => {
  assert.equal(show("=10^15"), "##########");
  assert.equal(show("=-10^15"), "##########");
  assert.equal(show("=10^15-1"), "999999999999999");
});
