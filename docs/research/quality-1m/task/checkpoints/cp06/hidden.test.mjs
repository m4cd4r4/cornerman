// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

const isErr = (v, code, cell) => v && typeof v === "object" && v.code === code && v.cell === cell;

test("cp06h precedence: comparison < & < +", () => {
  const s = createSheet();
  s.set("A1", "=1+1&1");
  assert.equal(s.get("A1"), "21");
  s.set("A2", "=1&2=12");
  assert.equal(s.get("A2"), false);
  // TRUE literal arrives in cp07; compare via a cell instead.
  s.set("B1", "=1<2");
  s.set("A3", "=1<2=B1");
  assert.equal(s.get("A3"), true);
});

test("cp06h text compares case-insensitively", () => {
  const s = createSheet();
  s.set("A1", "abc");
  s.set("A2", "ABC");
  s.set("B1", "=A1=A2");
  s.set("B2", "=A1<>A2");
  s.set("B3", "=A1<A2");
  assert.equal(s.get("B1"), true);
  assert.equal(s.get("B2"), false);
  assert.equal(s.get("B3"), false);
  s.set("A3", "abd");
  s.set("B4", "=A1<A3");
  assert.equal(s.get("B4"), true);
});

test("cp06h mixed types: number < text < boolean", () => {
  const s = createSheet();
  s.set("A1", "999999");
  s.set("A2", "a");
  s.set("A3", "=1=1"); // true
  s.set("A4", "=1=2"); // false
  s.set("B1", "=A1<A2");
  s.set("B2", "=A2<A4");
  s.set("B3", "=A4<A3");
  s.set("B4", "=A1>A4");
  assert.equal(s.get("B1"), true);
  assert.equal(s.get("B2"), true);
  assert.equal(s.get("B3"), true);
  assert.equal(s.get("B4"), false);
});

test("cp06h empty compares as the other side's zero value", () => {
  const s = createSheet();
  s.set("A3", "x");
  s.set("A4", "=1=2");
  s.set("B1", "=Z1=0");
  s.set("B2", "=Z1<A3");
  s.set("B3", "=Z1=A4");
  s.set("B4", "=Z1=Z2");
  assert.equal(s.get("B1"), true);
  assert.equal(s.get("B2"), true);
  assert.equal(s.get("B3"), true);
  assert.equal(s.get("B4"), true);
});

test("cp06h booleans in arithmetic", () => {
  const s = createSheet();
  s.set("A1", "=1<2");
  s.set("A2", "=A1+A1*10");
  assert.equal(s.get("A2"), 11);
  s.set("A3", "=-(1>2)");
  assert.equal(s.get("A3"), 0);
  assert.equal(s.display("A3"), "0");
});

test("cp06h concatenation uses display text", () => {
  const s = createSheet();
  s.set("A1", "=0.1+0.2");
  s.set("A2", "=1<2");
  s.set("B1", "=A1&A2&Z9");
  assert.equal(s.get("B1"), "0.3TRUE");
  s.set("B2", "=0.0000025&1");
  assert.equal(s.get("B2"), "0.0000021");
});

test("cp06h errors propagate through comparison and &", () => {
  const s = createSheet();
  s.set("A1", "=1/0");
  s.set("A2", "x");
  s.set("B1", "=A1=1");
  assert.ok(isErr(s.get("B1"), "#DIV/0!", "A1"));
  s.set("B2", "=A1&(A2*1)");
  assert.ok(isErr(s.get("B2"), "#VALUE!", "B2"));
});
