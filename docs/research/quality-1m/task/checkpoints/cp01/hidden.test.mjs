// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

const addrErr = (cell) => (e) => e && e.code === "#ADDR" && e.cell === cell && typeof e.message === "string" && e.message.length > 0;

test("cp01h number grammar is exact", () => {
  const s = createSheet();
  const cases = { "007": 7, "-3.25": -3.25, "0": 0, "10.0": 10 };
  for (const [input, want] of Object.entries(cases)) {
    s.set("A1", input);
    assert.equal(s.get("A1"), want, input);
  }
  for (const text of ["1e3", " 5", "5 ", "5.", ".5", "+5", "1,000", "--1", "1.2.3", "0x10"]) {
    s.set("A1", text);
    assert.equal(s.get("A1"), text, JSON.stringify(text));
  }
});

test("cp01h -0 is stored as 0", () => {
  const s = createSheet();
  s.set("A1", "-0");
  assert.ok(Object.is(s.get("A1"), 0));
  s.set("A2", "-0.0");
  assert.ok(Object.is(s.get("A2"), 0));
});

test("cp01h addresses are case-insensitive", () => {
  const s = createSheet();
  s.set("a1", "x");
  assert.equal(s.get("A1"), "x");
  s.set("zz9999", "edge");
  assert.equal(s.get("ZZ9999"), "edge");
  assert.deepEqual(s.cells(), ["A1", "ZZ9999"]);
});

test("cp01h invalid addresses throw on set and get with the address as given", () => {
  const s = createSheet();
  for (const a of ["A0", "a01", "A10000", "AAA1", "1A", "A", "", "A-1", "A1 "]) {
    assert.throws(() => s.set(a, "1"), addrErr(a), `set ${a}`);
    assert.throws(() => s.get(a), addrErr(a), `get ${a}`);
  }
});

test("cp01h cells() is row-major with AA after Z", () => {
  const s = createSheet();
  for (const a of ["A2", "AA1", "B1", "Z1", "A1", "C10", "C9"]) s.set(a, "1");
  s.set("C10", "");
  assert.deepEqual(s.cells(), ["A1", "B1", "Z1", "AA1", "A2", "C9"]);
});

test("cp01h text is stored untrimmed", () => {
  const s = createSheet();
  s.set("B1", "  padded  ");
  assert.equal(s.get("B1"), "  padded  ");
});
