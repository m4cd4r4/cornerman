// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

const isErr = (v, code, cell) => v && typeof v === "object" && v.code === code && v.cell === cell && typeof v.message === "string" && v.message.length > 0;

test("cp09h each cycle member carries its own address", () => {
  const s = createSheet();
  s.set("A1", "=B1");
  s.set("B1", "=C1*2");
  s.set("C1", "=A1+1");
  assert.ok(isErr(s.get("A1"), "#CYCLE!", "A1"));
  assert.ok(isErr(s.get("B1"), "#CYCLE!", "B1"));
  assert.ok(isErr(s.get("C1"), "#CYCLE!", "C1"));
});

test("cp09h a reader outside the cycle gets the origin cell", () => {
  const s = createSheet();
  s.set("B2", "=C2");
  s.set("C2", "=B2");
  s.set("D9", "=C2+1");
  s.set("E9", "=D9*2");
  assert.ok(isErr(s.get("E9"), "#CYCLE!", "C2"));
  assert.ok(isErr(s.get("D9"), "#CYCLE!", "C2"));
});

test("cp09h a cycle cell is #CYCLE! whatever else its formula gives", () => {
  const s = createSheet();
  s.set("A1", "=1/0+B1");
  s.set("B1", "=A1");
  assert.ok(isErr(s.get("A1"), "#CYCLE!", "A1"));
  s.set("C1", "=foo+C1");
  assert.ok(isErr(s.get("C1"), "#CYCLE!", "C1"));
});

test("cp09h #CYCLE! outranks #REF!", () => {
  const s = createSheet();
  s.set("A1", "=A1");
  s.set("B5", "=A0+A1");
  assert.ok(isErr(s.get("B5"), "#CYCLE!", "A1"));
  s.set("B6", "=1/0+A1+foo");
  assert.ok(isErr(s.get("B6"), "#CYCLE!", "A1"));
});

test("cp09h a cell that only reads a cycle is not on it", () => {
  const s = createSheet();
  s.set("A1", "=B1");
  s.set("B1", "=A1");
  s.set("C1", "=A1");
  assert.ok(isErr(s.get("C1"), "#CYCLE!", "A1"));
  s.set("A1", "1");
  assert.equal(s.get("C1"), 1);
  assert.equal(s.get("B1"), 1);
});

test("cp09h making and breaking a cycle by edits", () => {
  const s = createSheet();
  s.set("A1", "=B1+1");
  s.set("B1", "=C1+1");
  s.set("C1", "1");
  assert.equal(s.get("A1"), 3);
  s.set("C1", "=A1");
  assert.ok(isErr(s.get("A1"), "#CYCLE!", "A1"));
  assert.ok(isErr(s.get("C1"), "#CYCLE!", "C1"));
  s.set("C1", "");
  assert.equal(s.get("A1"), 2);
  assert.equal(s.display("C1"), "");
});
