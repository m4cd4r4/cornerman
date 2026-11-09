// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

const isErr = (v, code, cell) => v && typeof v === "object" && v.code === code && v.cell === cell;

test("cp04h priority beats position", () => {
  const s = createSheet();
  s.set("A1", "x");
  s.set("A2", "=A1*1"); // #VALUE! at A2
  s.set("B1", "=1/0+A2");
  assert.ok(isErr(s.get("B1"), "#VALUE!", "A2"));
  s.set("B2", "=A2+1/0");
  assert.ok(isErr(s.get("B2"), "#VALUE!", "A2"));
});

test("cp04h #REF! outranks everything so far", () => {
  const s = createSheet();
  s.set("A1", "x");
  s.set("C1", "=(A1*1)/0+A0");
  assert.ok(isErr(s.get("C1"), "#REF!", "C1"));
});

test("cp04h same code: row-major first origin wins", () => {
  const s = createSheet();
  s.set("B2", "=1/0");
  s.set("C1", "=1/0");
  s.set("D9", "=B2+C1");
  assert.ok(isErr(s.get("D9"), "#DIV/0!", "C1"));
  s.set("D8", "=C1+B2");
  assert.ok(isErr(s.get("D8"), "#DIV/0!", "C1"));
  s.set("AA1", "=1/0");
  s.set("D7", "=AA1+B2");
  assert.ok(isErr(s.get("D7"), "#DIV/0!", "AA1"));
});

test("cp04h own-cell errors compete with propagated ones by order", () => {
  const s = createSheet();
  s.set("A5", "=1/0");
  s.set("B1", "=A5+1/0");
  assert.ok(isErr(s.get("B1"), "#DIV/0!", "B1"));
  s.set("C9", "=A5+1/0");
  assert.ok(isErr(s.get("C9"), "#DIV/0!", "A5"));
});

test("cp04h message survives propagation", () => {
  const s = createSheet();
  s.set("A1", "=1/0");
  s.set("A2", "=A1");
  s.set("A3", "=-A2");
  assert.deepEqual(s.get("A3"), s.get("A1"));
});

test("cp04h typed error codes are just text", () => {
  const s = createSheet();
  s.set("A1", "#VALUE!");
  assert.equal(s.get("A1"), "#VALUE!");
  s.set("A2", "=A1*1");
  assert.ok(isErr(s.get("A2"), "#VALUE!", "A2"));
});
