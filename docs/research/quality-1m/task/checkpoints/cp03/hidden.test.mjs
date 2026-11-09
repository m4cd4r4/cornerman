// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

const isErr = (v, code, cell) => v && typeof v === "object" && v.code === code && v.cell === cell;

test("cp03h references are case-insensitive and chain", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.set("B1", "=a1+1");
  s.set("C1", "=b1*A1+B1");
  assert.equal(s.get("C1"), 4);
  s.set("A1", "");
  assert.equal(s.get("C1"), 1);
});

test("cp03h invalid references are #REF! at the formula cell", () => {
  const s = createSheet();
  for (const r of ["A0", "B01", "C10000"]) {
    s.set("E5", `=${r}+1`);
    assert.ok(isErr(s.get("E5"), "#REF!", "E5"), r);
  }
});

test("cp03h three-letter references do not parse", () => {
  const s = createSheet();
  s.set("A1", "=ABC1+1");
  assert.ok(isErr(s.get("A1"), "#PARSE!", "A1"));
});

test("cp03h text in arithmetic is #VALUE! at the formula cell", () => {
  const s = createSheet();
  s.set("A1", "abc");
  s.set("B2", "=A1+1");
  assert.ok(isErr(s.get("B2"), "#VALUE!", "B2"));
  s.set("A1", "1e3");
  assert.ok(isErr(s.get("B2"), "#VALUE!", "B2"));
  s.set("A1", "5");
  assert.equal(s.get("B2"), 6);
});

test("cp03h a reference alone returns the referenced value", () => {
  const s = createSheet();
  s.set("A1", "hi");
  s.set("B1", "=A1");
  assert.equal(s.get("B1"), "hi");
  s.set("C1", "=Q7");
  assert.equal(s.get("C1"), 0);
});
