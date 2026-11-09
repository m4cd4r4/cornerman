// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

const isErr = (v, code, cell) => v && typeof v === "object" && v.code === code && v.cell === cell;
function val(f) {
  const s = createSheet();
  s.set("B3", f);
  return s.get("B3");
}

test("cp07h doubled quotes", () => {
  assert.equal(val('="say ""hi"""'), 'say "hi"');
  assert.equal(val('=""""'), '"');
  assert.equal(val('=""'), "");
  assert.ok(isErr(val('="abc'), "#PARSE!", "B3"));
  assert.ok(isErr(val('="a""'), "#PARSE!", "B3"));
});

test("cp07h boolean literals are case-insensitive", () => {
  assert.equal(val("=true"), true);
  assert.equal(val("=False"), false);
  assert.equal(val("=TRUE+TRUE"), 2);
  assert.equal(val('=TRUE>"zzz"'), true);
});

test("cp07h percent binds tighter than power and repeats", () => {
  assert.ok(Math.abs(val("=2^50%") - Math.SQRT2) < 1e-12);
  assert.equal(val("=-50%"), -0.5);
  assert.equal(val("=50%%"), 0.005);
  assert.equal(val("=(1+1)%"), 0.02);
  assert.equal(val("=200%*3"), 6);
  assert.equal(val("=50%^2"), 0.25);
  assert.equal(val("=-50%^2"), -0.25);
});

test("cp07h unknown names are #NAME? and sit in the priority order", () => {
  assert.ok(isErr(val("=foo"), "#NAME?", "B3"));
  assert.ok(isErr(val("=foo+1/0"), "#NAME?", "B3"));
  assert.ok(isErr(val("=foo+A0"), "#REF!", "B3"));
  const s = createSheet();
  s.set("A1", "x");
  s.set("A2", "=A1*1");
  s.set("C1", "=A2+bar");
  assert.ok(isErr(s.get("C1"), "#NAME?", "C1"));
});

test("cp07h string literal arithmetic is #VALUE!", () => {
  assert.ok(isErr(val('="5"+1'), "#VALUE!", "B3"));
  assert.equal(val('="5"&1'), "51");
});
