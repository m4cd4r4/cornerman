// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

const isErr = (v, code, cell) => v && typeof v === "object" && v.code === code && v.cell === cell && typeof v.message === "string" && v.message.length > 0;
const TABLE = {
  K1: "apple", L1: "10",
  K2: "Banana", L2: "20",
  K3: "1", L3: "30",
  K4: '="1"', L4: "40",
  K5: "=TRUE", L5: "50",
  L6: "60",
  K7: "=1/0", L7: "70",
  K8: "cherry", L8: "=1/0",
  K9: "apple", L9: "90",
  P1: "0.3", Q1: "ok",
};
function sheet(setup = TABLE) {
  const s = createSheet();
  for (const [k, v] of Object.entries(setup)) s.set(k, v);
  return s;
}
function val(f, setup = TABLE) {
  const s = sheet(setup);
  s.set("Z99", f);
  return s.get("Z99");
}

test("cp21h matching is type-strict and ignores case", () => {
  assert.equal(val("=VLOOKUP(1, K1:L9, 2)"), 30);
  assert.equal(val('=VLOOKUP("1", K1:L9, 2)'), 40);
  assert.equal(val("=VLOOKUP(TRUE, K1:L9, 2)"), 50);
  assert.equal(val('=VLOOKUP("APPLE", K1:L9, 2)'), 10);
  assert.equal(val('=VLOOKUP("banana", K1:L9, 2)'), 20);
  assert.equal(val("=VLOOKUP(0.1+0.2, P1:Q1, 2)"), "ok");
});

test("cp21h no match, blank keys and blank cells", () => {
  assert.ok(isErr(val('=VLOOKUP("pear", K1:L9, 2)'), "#N/A", "Z99"));
  assert.ok(isErr(val("=VLOOKUP(B1, K1:L9, 2)"), "#N/A", "Z99"));
  assert.ok(isErr(val("=VLOOKUP(0, K1:L9, 2)"), "#N/A", "Z99"));
  assert.ok(isErr(val('=VLOOKUP("", K1:L9, 2)'), "#N/A", "Z99"));
  assert.ok(isErr(val("=VLOOKUP(FALSE, K1:L9, 2)"), "#N/A", "Z99"));
  assert.ok(isErr(val('=VLOOKUP("1", K1:L3, 2)'), "#N/A", "Z99"));
});

test("cp21h error cells are skipped; the result cell is read as it is", () => {
  assert.equal(val('=VLOOKUP("cherry", K1:L9, 1)'), "cherry");
  assert.ok(isErr(val('=VLOOKUP("cherry", K1:L9, 2)'), "#DIV/0!", "L8"));
  assert.equal(val('=VLOOKUP("apple", K1:M9, 3)'), 0);
});

test("cp21h the column is truncated and must be inside the table", () => {
  assert.equal(val('=VLOOKUP("apple", K1:L9, 1)'), "apple");
  assert.equal(val('=VLOOKUP("apple", K1:L9, 2.9)'), 10);
  for (const c of ["0", "0.5", "-1", "3"]) assert.ok(isErr(val(`=VLOOKUP("apple", K1:L9, ${c})`), "#REF!", "Z99"), c);
  assert.ok(isErr(val('=VLOOKUP("apple", K1:L9, "2")'), "#VALUE!", "Z99"));
  assert.ok(isErr(val('=VLOOKUP("nothing", K1:L9, 5)'), "#REF!", "Z99"));
});

test("cp21h the table is a range argument", () => {
  assert.equal(val('=VLOOKUP("apple", K1, 1)'), "apple");
  assert.ok(isErr(val("=VLOOKUP(1, 5, 1)"), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=VLOOKUP(1, NOPE, 1)"), "#NAME?", "Z99"));
  assert.ok(isErr(val("=VLOOKUP(1, K0:L3, 1)"), "#REF!", "Z99"));
  const s = sheet();
  s.defineName("T", "K1:L9");
  s.set("Z99", '=VLOOKUP("banana", T, 2)');
  assert.equal(s.get("Z99"), 20);
});

test("cp21h exactly three arguments", () => {
  assert.ok(isErr(val("=VLOOKUP(1, K1:L9)"), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=VLOOKUP(1, K1:L9, 2, FALSE)"), "#VALUE!", "Z99"));
});

test("cp21h argument errors follow the priority order", () => {
  assert.ok(isErr(val("=VLOOKUP(1/0, K1:L9, 0)"), "#DIV/0!", "Z99"));
  assert.ok(isErr(val("=VLOOKUP(1/0, NOPE, 2)"), "#NAME?", "Z99"));
  assert.ok(isErr(val("=VLOOKUP(B1, K1:L9, 2)", { ...TABLE, B1: "=FOO()" }), "#NAME?", "B1"));
});

test("cp21h #N/A sits between #NAME? and #VALUE! in the priority order", () => {
  assert.ok(isErr(val('=VLOOKUP("pear", K1:L9, 2) + 1/0'), "#N/A", "Z99"));
  assert.ok(isErr(val('=SUM(1/0, "x" + 1, VLOOKUP("pear", K1:L9, 2))'), "#N/A", "Z99"));
  assert.ok(isErr(val('=VLOOKUP("pear", K1:L9, 2) + FOO()'), "#NAME?", "Z99"));
  assert.ok(isErr(val('=VLOOKUP("pear", K1:L9, 2) + K0'), "#REF!", "Z99"));
});

test("cp21h every table cell is referred to", () => {
  const s = sheet({});
  s.set("Z99", "=VLOOKUP(1, K1:L2, 2)");
  assert.deepEqual(s.precedents("Z99"), ["K1", "L1", "K2", "L2"]);
  s.set("K2", "1");
  s.set("L2", "found");
  assert.equal(s.get("Z99"), "found");
});
