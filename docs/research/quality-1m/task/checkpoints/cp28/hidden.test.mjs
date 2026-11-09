// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

function sheet(setup = {}) {
  const s = createSheet();
  for (const [k, v] of Object.entries(setup)) s.set(k, v);
  return s;
}

test("cp28h empty sheet and the rectangle from A1", () => {
  assert.equal(createSheet().toCSV(), "");
  assert.equal(createSheet().toCSV({ formulas: true }), "");
  assert.equal(sheet({ C3: "x" }).toCSV(), ",,\n,,\n,,x");
  assert.equal(sheet({ A1: "1" }).toCSV(), "1");
  assert.equal(sheet({ B1: "b", A4: "a" }).toCSV(), ",b\n,\n,\na,");
  const s = sheet({ A1: "1", D2: "2" });
  s.set("D2", "");
  assert.equal(s.toCSV(), "1");
});

test("cp28h display text in values mode", () => {
  const s = sheet({ A1: "=1/3", B1: "=1/0", C1: "=1=1", D1: "=10^15", E1: '=""', F1: "=Z99", G1: "007", H1: "=1+" });
  assert.equal(s.toCSV(), "0.333333,#DIV/0!,TRUE,##########,,0,7,#PARSE!");
  assert.equal(s.toCSV({ formulas: true }), '=1/3,=1/0,=1=1,=10^15,"=""""",=Z99,007,=1+');
});

test("cp28h quoting rules", () => {
  const cases = [
    ["plain", "plain"],
    ["a,b", '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ['"', '""""'],
    ["two\nlines", '"two\nlines"'],
    ["cr\rhere", '"cr\rhere"'],
    [" lead", '" lead"'],
    ["trail ", '"trail "'],
    ["in side", "in side"],
    ["tab\t", "tab\t"],
    ["semi;colon", "semi;colon"],
    ["'apos'", "'apos'"],
  ];
  for (const [input, want] of cases) assert.equal(sheet({ A1: input }).toCSV(), want, JSON.stringify(input));
  assert.equal(sheet({ A1: '="a,"&"b"' }).toCSV(), '"a,b"');
  assert.equal(sheet({ A1: '="a,"&"b"' }).toCSV({ formulas: true }), '"=""a,""&""b"""');
});

test("cp28h every row has the same field count, LF only, no trailing newline", () => {
  const s = sheet({ A1: "x", C2: "y,z", B3: " " });
  const text = s.toCSV();
  assert.equal(text, 'x,,\n,,"y,z"\n," ",');
  assert.ok(!text.includes("\r"));
  assert.ok(!text.endsWith("\n"));
});

test("cp28h evaluation counting and no undo step", () => {
  const s = sheet({ A1: "2", B1: "=A1*2", C1: "=B1+1" });
  const before = s.stats().evaluations;
  assert.equal(s.toCSV({ formulas: true }), "2,=A1*2,=B1+1");
  assert.equal(s.stats().evaluations - before, 0);
  assert.equal(s.toCSV(), "2,4,5");
  assert.equal(s.stats().evaluations - before, 2);
  assert.equal(s.toCSV(), "2,4,5");
  assert.equal(s.stats().evaluations - before, 2);
  s.undo();
  assert.equal(s.toCSV(), "2,4");
});
