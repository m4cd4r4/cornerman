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

test("cp17h conditions: numbers, empty, text, errors", () => {
  assert.equal(val('=IF(-0.5, "y", "n")'), "y");
  assert.equal(val('=IF(0, "y", "n")'), "n");
  assert.equal(val('=IF(B1, "y", "n")'), "n");
  assert.equal(val('=IF(B1, "y", "n")', { B1: "=TRUE" }), "y");
  assert.ok(isErr(val('=IF("TRUE", 1, 2)'), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=IF(B1, 1, 2)", { B1: "x" }), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=IF(1/0, 1, 2)"), "#DIV/0!", "Z99"));
  assert.ok(isErr(val("=IF(B1, 1, 2)", { B1: "=FOO()" }), "#NAME?", "B1"));
});

test("cp17h IF evaluates only the chosen branch", () => {
  assert.equal(val("=IF(TRUE, 1, 1/0)"), 1);
  assert.equal(val("=IF(FALSE, 1/0, 2)"), 2);
  assert.equal(val("=IF(FALSE, FOO())"), false);
  assert.equal(val("=IF(TRUE, B1)"), 0);
  assert.equal(val("=IF(TRUE, B1, 2)", { B1: "hi" }), "hi");
  assert.ok(isErr(val("=IF(TRUE, B1:B2)"), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=IF(FALSE, 1, 1/0)"), "#DIV/0!", "Z99"));
});

test("cp17h IF takes two or three arguments", () => {
  assert.ok(isErr(val("=IF(TRUE)"), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=IF(TRUE, 1, 2, 3)"), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=IF()"), "#VALUE!", "Z99"));
});

test("cp17h every branch is referred to, whichever runs", () => {
  const s = sheet();
  s.set("A1", "=IF(TRUE, 1, A1)");
  assert.ok(isErr(s.get("A1"), "#CYCLE!", "A1"));
  const t = sheet();
  t.set("Z99", "=IF(B1>0, C1, D1)");
  assert.deepEqual(t.precedents("Z99"), ["B1", "C1", "D1"]);
  assert.deepEqual(t.dependents("D1"), ["Z99"]);
});

test("cp17h AND and OR over ranges count booleans and numbers only", () => {
  const setup = { B1: "=TRUE", B2: "1", B3: "x", B4: "" };
  assert.equal(val("=AND(B1:B4)", setup), true);
  assert.equal(val("=AND(B1:B4)", { ...setup, B2: "0" }), false);
  assert.equal(val("=OR(B1:B4)", { ...setup, B1: "=FALSE", B2: "0" }), false);
  assert.equal(val("=OR(B1:B4)", { ...setup, B1: "=FALSE" }), true);
  assert.ok(isErr(val("=AND(B3)", setup), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=OR(B3:B5)", setup), "#VALUE!", "Z99"));
  assert.ok(isErr(val('=AND(B1:B4, "x")', setup), "#VALUE!", "Z99"));
  const s = sheet({ ...setup, B2: "0" });
  s.defineName("R", "B1:B3");
  s.set("Z99", "=OR(R)");
  assert.equal(s.get("Z99"), true);
});

test("cp17h AND and OR evaluate every argument", () => {
  assert.ok(isErr(val("=AND(FALSE, 1/0)"), "#DIV/0!", "Z99"));
  assert.ok(isErr(val("=OR(TRUE, 1/0)"), "#DIV/0!", "Z99"));
  assert.ok(isErr(val("=AND(1/0, FOO())"), "#NAME?", "Z99"));
  assert.ok(isErr(val("=OR(B1:B2)", { B1: "=TRUE", B2: "=1/0" }), "#DIV/0!", "B2"));
  assert.ok(isErr(val("=AND()"), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=OR()"), "#VALUE!", "Z99"));
});

test("cp17h direct arguments are conditions", () => {
  assert.equal(val("=AND(1, 2>1, TRUE, -3)"), true);
  assert.equal(val("=OR(0, FALSE, 1-1)"), false);
  assert.equal(val("=AND(B1+1)"), true);
  assert.ok(isErr(val('=OR("")'), "#VALUE!", "Z99"));
  assert.ok(isErr(val('=OR(TRUE, B1&"")'), "#VALUE!", "Z99"));
});

test("cp17h NOT", () => {
  assert.equal(val("=NOT(B1)"), true);
  assert.equal(val("=NOT(2)"), false);
  assert.equal(val("=NOT(1>2)"), true);
  assert.ok(isErr(val('=NOT("x")'), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=NOT()"), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=NOT(1, 2)"), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=NOT(B1:B2)"), "#VALUE!", "Z99"));
});
