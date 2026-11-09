// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

const isErr = (v, code, cell) => v && typeof v === "object" && v.code === code && v.cell === cell && typeof v.message === "string" && v.message.length > 0;
function sheet(setup = {}) {
  const s = createSheet();
  for (const [k, v] of Object.entries(setup)) s.set(k, v);
  return s;
}
function val(f, setup = {}) {
  const s = sheet(setup);
  s.set("Z99", f);
  return s.get("Z99");
}
const loop = { B1: "=B2", B2: "=B1" };

test("cp20h ISERROR on values, ranges and unknown functions", () => {
  assert.equal(val("=ISERROR(B1)"), false);
  assert.equal(val('=ISERROR("x")'), false);
  assert.equal(val("=ISERROR(FALSE)"), false);
  assert.equal(val("=ISERROR(FOO())"), true);
  assert.equal(val("=ISERROR(B1:B2)"), true);
  const s = sheet();
  s.defineName("R", "B1:B3");
  s.set("Z99", "=ISERROR(R)");
  assert.equal(s.get("Z99"), true);
});

test("cp20h ISERROR sees errors in other cells, cycles and parse errors included", () => {
  assert.equal(val("=ISERROR(B1)", { B1: "=1/0" }), true);
  assert.equal(val("=ISERROR(B1)", { B1: "=1+" }), true);
  assert.equal(val("=ISERROR(B1)", loop), true);
  assert.equal(val("=ISERROR(B1+1)", { B1: "x" }), true);
});

test("cp20h wrong argument counts are errors, not TRUE", () => {
  for (const f of ["=ISERROR()", "=ISERROR(1, 2)", "=IFERROR(1)", "=IFERROR(1, 2, 3)", "=IFERROR()"]) {
    assert.ok(isErr(val(f), "#VALUE!", "Z99"), f);
  }
});

test("cp20h IFERROR catches errors", () => {
  assert.equal(val("=IFERROR(B1, 5)", { B1: "=FOO()" }), 5);
  assert.equal(val('=IFERROR("x" + 1, "bad")'), "bad");
  assert.equal(val("=IFERROR(B1:B2, 7)"), 7);
  assert.equal(val("=IFERROR(NOPE, 8)"), 8);
  assert.equal(val("=IFERROR(B1, 5)"), 0);
  assert.equal(val('=IFERROR(B1, 5)', { B1: "text" }), "text");
});

test("cp20h IFERROR evaluates the fallback only when needed", () => {
  assert.equal(val("=IFERROR(1, 1/0)"), 1);
  assert.equal(val("=IFERROR(2, FOO())"), 2);
  assert.ok(isErr(val("=IFERROR(1/0, FOO())"), "#NAME?", "Z99"));
  assert.ok(isErr(val("=IFERROR(1/0, B1)", { B1: "=1/0" }), "#DIV/0!", "B1"));
});

test("cp20h IFERROR never catches #CYCLE!", () => {
  assert.ok(isErr(val("=IFERROR(B1, 0)", loop), "#CYCLE!", "B1"));
  assert.ok(isErr(val("=IFERROR(B1 + 1, 0)", loop), "#CYCLE!", "B1"));
  assert.equal(val("=ISERROR(IFERROR(B1, 0))", loop), true);
  assert.ok(isErr(val("=IFERROR(Z99, 0)"), "#CYCLE!", "Z99"));
});

test("cp20h both IFERROR arguments are referred to", () => {
  assert.ok(isErr(val("=IFERROR(1, Z99)"), "#CYCLE!", "Z99"));
  const s = sheet();
  s.set("Z99", "=IFERROR(B1, C1)");
  assert.deepEqual(s.precedents("Z99"), ["B1", "C1"]);
});
