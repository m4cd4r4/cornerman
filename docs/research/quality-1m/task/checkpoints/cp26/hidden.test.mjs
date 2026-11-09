// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

const isErr = (v, code, cell) => v && typeof v === "object" && v.code === code && v.cell === cell && typeof v.message === "string" && v.message.length > 0;
const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
function sheet(setup = {}) {
  const s = createSheet();
  for (const [k, v] of Object.entries(setup)) s.set(k, v);
  return s;
}
// Copy the formula in A1 to `to` and return what landed there.
function copied(formula, to) {
  const s = sheet({ A1: formula });
  s.copy("A1", to);
  return s.getInput(to);
}

test("cp26h $ forms read the same cell", () => {
  const s = sheet({ A1: "2", B3: "5", Z99: "=$A$1+A$1+$a1+a1" });
  assert.equal(s.get("Z99"), 8);
  assert.deepEqual(s.precedents("Z99"), ["A1"]);
  s.set("Z98", "=SUM($A$1:b$3)");
  assert.equal(s.get("Z98"), 7);
  s.set("A1", "=$Z$98");
  assert.ok(isErr(s.get("A1"), "#CYCLE!", "A1"));
});

test("cp26h other uses of $ are parse errors", () => {
  const s = createSheet();
  for (const f of ["=A$$1", "=$$A1", "=$A", "=A1$", "=$1", "=$SUM(1)", "=SUM(A1:$B)"]) {
    s.set("Z99", f);
    assert.ok(isErr(s.get("Z99"), "#PARSE!", "Z99"), f);
  }
  assert.throws(() => s.defineName("R", "$A$1"), thrown("#ADDR", "$A$1"));
});

test("cp26h insert and delete keep the $ marks", () => {
  const s = sheet({ Z99: "=$a$1+A$2+$b3" });
  s.insertRows(1);
  assert.equal(s.getInput("Z100"), "=$A$2+A$3+$B4");
  s.insertCols("B");
  assert.equal(s.getInput("AA100"), "=$A$2+A$3+$C4");
  s.deleteCols("C");
  assert.equal(s.getInput("Z100"), "=$A$2+A$3+#REF!");
});

test("cp26h copying one formula moves relative parts only", () => {
  assert.equal(copied("=B1+$B$1+B$1+$B1", "C3"), "=D3+$B$1+D$1+$B3");
  assert.equal(copied("=b2*2", "A2"), "=B3*2");
  assert.equal(copied("=$b$2*2", "D9"), "=$b$2*2");
  assert.equal(copied('=LOG10(B1)&"B1"&TAX', "A3"), '=LOG10(B3)&"B1"&TAX');
  assert.equal(copied("=SUM(B1:C2)", "B1"), "=SUM(C1:D2)");
  assert.equal(copied("=SUM(c2:B1)", "A2"), "=SUM(C3:B2)");
  assert.equal(copied("=1+", "B2"), "=1+");
  assert.equal(copied("=SUM(B1:ZY1)", "C1"), "=SUM(#REF!)");
  assert.equal(copied("=SUM(B1:$ZY1)", "C1"), "=SUM(D1:$ZY1)");
});

test("cp26h references moved off the sheet become #REF!", () => {
  const up = sheet({ A2: "=SUM(a1:B1)+$b$1+A1", B2: "=ZY1" });
  up.copy("A2", "B1");
  assert.equal(up.getInput("B1"), "=SUM(#REF!)+$b$1+#REF!");
  up.copy("B2", "C2");
  assert.equal(up.getInput("C2"), "=ZZ1");
  up.copy("B2", "D2");
  assert.equal(up.getInput("D2"), "=#REF!");
  up.copy("B2", "B9999");
  assert.equal(up.getInput("B9999"), "=ZY9998");
  const s = sheet({ C3: "=A$1+$A1" });
  s.copy("C3", "A1");
  assert.equal(s.getInput("A1"), "=#REF!+#REF!");
  assert.ok(isErr(s.get("A1"), "#REF!", "A1"));
});

test("cp26h copying a range, empties and constants", () => {
  const s = sheet({ A1: "1", B1: "x", A2: "=A1+B2", D5: "old", E6: "old" });
  s.copy("B2:a1", "D5");
  assert.deepEqual(s.cells(), ["A1", "B1", "A2", "D5", "E5", "D6"]);
  assert.equal(s.getInput("D5"), "1");
  assert.equal(s.getInput("E5"), "x");
  assert.equal(s.getInput("D6"), "=D5+E6");
  assert.equal(s.getInput("E6"), null);
  assert.equal(s.get("D6"), 1);
});

test("cp26h overlapping copies read every source first", () => {
  const s = sheet({ A1: "1", A2: "=A1+1", A3: "=A2+1" });
  s.copy("A1:A3", "A2");
  assert.deepEqual([s.getInput("A2"), s.getInput("A3"), s.getInput("A4")], ["1", "=A2+1", "=A3+1"]);
  assert.equal(s.get("A4"), 3);
  const t = sheet({ B1: "1", C1: "=B1*2", D1: "=C1*2" });
  t.copy("C1:D1", "B1");
  assert.deepEqual([t.getInput("B1"), t.getInput("C1"), t.getInput("D1")], ["=A1*2", "=B1*2", "=C1*2"]);
  assert.equal(t.get("D1"), 0);
});

test("cp26h bad arguments throw and change nothing", () => {
  const s = sheet({ A1: "1", B1: "=A1" });
  assert.throws(() => s.copy("A0", "B2"), thrown("#ADDR", "A0"));
  assert.throws(() => s.copy("A1:B1:C1", "B2"), thrown("#ADDR", "A1:B1:C1"));
  assert.throws(() => s.copy("A1:", "B2"), thrown("#ADDR", "A1:"));
  assert.throws(() => s.copy("$A$1", "B2"), thrown("#ADDR", "$A$1"));
  assert.throws(() => s.copy("A1", "B2:C3"), thrown("#ADDR", "B2:C3"));
  assert.throws(() => s.copy("A1", 5), thrown("#ADDR", 5));
  assert.throws(() => s.copy("A1:J1001", "B2"), thrown("#ARG", "A1:J1001"));
  assert.throws(() => s.copy("A1:B1", "ZZ5"), thrown("#ARG", "ZZ5"));
  assert.throws(() => s.copy("A1:A2", "c9999"), thrown("#ARG", "c9999"));
  s.copy("A1:B1", "ZY9999");
  assert.equal(s.getInput("ZZ9999"), "=ZY9999");
  s.copy("A1:J1000", "A1");
  assert.deepEqual(s.cells(), ["A1", "B1", "ZY9999", "ZZ9999"]);
});

test("cp26h names are untouched and recalculation follows the new text", () => {
  const s = sheet({ B1: "4", B2: "5", A1: "=B1*TAX", Z1: "=A2+1" });
  s.defineName("TAX", "C1");
  s.set("C1", "3");
  assert.equal(s.get("Z1"), 1);
  const before = s.stats().evaluations;
  s.copy("A1", "A2");
  assert.equal(s.getInput("A2"), "=B2*TAX");
  assert.deepEqual(s.names(), { TAX: "C1" });
  assert.equal(s.get("Z1"), 16);
  assert.equal(s.stats().evaluations - before, 2);
  assert.deepEqual(s.dependents("B2"), ["A2"]);
  const again = s.stats().evaluations;
  s.copy("A1", "A2");
  s.copy("A1", "A1");
  assert.equal(s.get("Z1"), 16);
  assert.equal(s.stats().evaluations - again, 0);
});
