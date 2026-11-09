// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

function val(f) {
  const s = createSheet();
  s.set("A1", f);
  return s.get("A1");
}

test("cp08h tolerance is relative to magnitude", () => {
  assert.equal(val("=1000000+0.0001=1000000"), true); // 1e-4 <= 1e-9*1e6 = 1e-3
  assert.equal(val("=1000000+0.01=1000000"), false); // 1e-2 > 1e-3
  assert.equal(val("=0.0000000005=0"), true); // floor of max(1, ...)
  assert.equal(val("=0.000000002=0"), false);
});

test("cp08h strict and non-strict orderings respect tolerance", () => {
  assert.equal(val("=0.1+0.2<0.3"), false);
  assert.equal(val("=0.1+0.2>0.3"), false);
  assert.equal(val("=0.1+0.2<=0.3"), true);
  assert.equal(val("=0.1+0.2>=0.3"), true);
  assert.equal(val("=0.1+0.2<>0.3"), false);
  assert.equal(val("=1<1.1"), true);
});

test("cp08h tolerance does not touch arithmetic or display", () => {
  const s = createSheet();
  s.set("A1", "=0.1+0.2");
  assert.equal(s.get("A1"), 0.30000000000000004);
  s.set("A2", "=1000000.0001-1000000");
  assert.ok(s.get("A2") > 0);
});

test("cp08h counter counts every formula evaluation and caches until set", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.set("B1", "=A1+1");
  s.set("C1", "=B1+B1");
  const n0 = s.stats().evaluations;
  assert.equal(s.get("C1"), 4);
  const n1 = s.stats().evaluations;
  assert.equal(n1 - n0, 2); // C1 and B1, B1 once
  s.get("C1");
  s.get("B1");
  s.display("C1");
  assert.equal(s.stats().evaluations, n1);
  s.set("A1", "2");
  assert.equal(s.get("C1"), 6);
  assert.ok(s.stats().evaluations > n1);
});

test("cp08h stats returns a fresh object", () => {
  const s = createSheet();
  const a = s.stats();
  s.set("A1", "=1");
  s.get("A1");
  assert.equal(a.evaluations, 0);
  assert.equal(s.stats().evaluations, 1);
});
