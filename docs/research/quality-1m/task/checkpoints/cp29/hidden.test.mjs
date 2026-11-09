// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
function sheet(setup = {}) {
  const s = createSheet();
  for (const [k, v] of Object.entries(setup)) s.set(k, v);
  return s;
}
const inputs = (s) => s.toCSV({ formulas: true });

test("cp29h records, line ends and quoting", () => {
  const s = createSheet();
  s.fromCSV('a,b\n"1,2",=1+1\r\n,x\n');
  assert.equal(inputs(s), 'a,b\n"1,2",=1+1\n,x');
  assert.equal(s.get("B2"), 2);
  const src = 'x,"a,b","say ""hi"""\n" p",,"two\nlines"';
  const t = createSheet();
  t.fromCSV(src);
  assert.equal(t.getInput("C2"), "two\nlines");
  assert.equal(t.getInput("C1"), 'say "hi"');
  assert.equal(inputs(t), src);
  const u = createSheet();
  u.fromCSV(' a ,b\t;c,"""q"""');
  assert.equal(u.getInput("A1"), " a ");
  assert.equal(u.getInput("B1"), "b\t;c");
  assert.equal(u.getInput("C1"), '"q"');
});

test("cp29h trailing line ends and empty text", () => {
  const s = sheet({ A1: "orig", A2: "keep" });
  s.fromCSV("");
  assert.equal(inputs(s), "orig\nkeep");
  s.fromCSV("a\n");
  assert.equal(inputs(s), "a\nkeep");
  s.fromCSV("b\r\n");
  assert.equal(inputs(s), "b\nkeep");
  s.fromCSV("c\n\n");
  assert.equal(inputs(s), "c");
  const t = sheet({ A1: "orig" });
  t.fromCSV("\n");
  assert.equal(t.toCSV(), "");
  const u = sheet({ A2: "z" });
  u.fromCSV("a\n\nb");
  assert.equal(inputs(u), "a\n\nb");
});

test("cp29h placement at, short records and formulas left as written", () => {
  const s = sheet({ A1: "=B1", C1: "keep", B1: "old", A2: "z", C2: "c2" });
  s.fromCSV("p,q\nr", "B1");
  assert.equal(inputs(s), "=B1,p,q\nz,r,c2");
  assert.equal(s.get("A1"), "p");
  s.fromCSV('"=""x""&1","=A1"', "d5");
  assert.equal(s.get("D5"), "x1");
  assert.equal(s.getInput("E5"), "=A1");
  assert.equal(s.get("E5"), "p");
  const t = createSheet();
  t.fromCSV("007,1.50,TRUE,=A1+B1");
  assert.deepEqual([t.get("A1"), t.get("B1"), t.get("C1"), t.get("D1")], [7, 1.5, "TRUE", 8.5]);
  const u = sheet({ C1: "=A1+B1" });
  u.fromCSV("2,3");
  assert.equal(u.get("C1"), 5);
});

test("cp29h empty fields clear", () => {
  const s = sheet({ A1: "1", B1: "2", C1: "3" });
  s.fromCSV(',n,""');
  assert.equal(inputs(s), ",n");
  assert.equal(s.getInput("A1"), null);
});

test("cp29h malformed text names the first bad record", () => {
  const cases = [
    ['a\n"b', "2"],
    ['"a"b', "1"],
    ['"a" ', "1"],
    ['x\na"b', "2"],
    ["a\rb", "1"],
    ["a\r", "1"],
    ['x,"a\nb"\nc"d', "2"],
    ['ok\n"two\nlines"\n"open', "3"],
    ['a\n"b\r\n', "2"],
  ];
  for (const [text, rec] of cases) {
    const s = sheet({ A1: "orig" });
    assert.throws(() => s.fromCSV(text), thrown("#CSV", rec), JSON.stringify(text));
    assert.equal(inputs(s), "orig");
  }
});

test("cp29h bad at and bad text", () => {
  const s = sheet({ A1: "orig" });
  assert.throws(() => s.fromCSV("a", "A0"), thrown("#ADDR", "A0"));
  assert.throws(() => s.fromCSV("a", "$B$2"), thrown("#ADDR", "$B$2"));
  assert.throws(() => s.fromCSV("a", "B2:C3"), thrown("#ADDR", "B2:C3"));
  assert.throws(() => s.fromCSV("a", "A10000"), thrown("#ADDR", "A10000"));
  assert.throws(() => s.fromCSV(5), thrown("#ARG", "5"));
  assert.throws(() => s.fromCSV(null), thrown("#ARG", "null"));
  assert.throws(() => s.fromCSV(5, "A0"), thrown("#ADDR", "A0"));
  assert.throws(() => s.fromCSV('"bad', "A0"), thrown("#ADDR", "A0"));
  assert.throws(() => s.fromCSV("", "A0"), thrown("#ADDR", "A0"));
  assert.equal(inputs(s), "orig");
  assert.equal(s.undo(), true);
  assert.equal(s.undo(), false);
});

test("cp29h the sheet edge", () => {
  const s = createSheet();
  s.fromCSV("a", "ZZ9999");
  assert.equal(s.getInput("ZZ9999"), "a");
  s.fromCSV("b\n", "zz9999");
  assert.equal(s.getInput("ZZ9999"), "b");
  s.fromCSV("p,q\nr", "ZY9998");
  assert.deepEqual([s.getInput("ZY9998"), s.getInput("ZZ9998"), s.getInput("ZY9999")], ["p", "q", "r"]);
  const t = sheet({ A1: "orig" });
  assert.throws(() => t.fromCSV("a,b", "ZZ9999"), thrown("#FULL", "ZZ9999"));
  assert.throws(() => t.fromCSV("a\nb", "A9999"), thrown("#FULL", "A9999"));
  assert.throws(() => t.fromCSV("a\n\n", "A9999"), thrown("#FULL", "A9999"));
  assert.throws(() => t.fromCSV("a,b,c\nd", "zy1"), thrown("#FULL", "zy1"));
  assert.throws(() => t.fromCSV('a\n"b', "ZZ9999"), thrown("#CSV", "2"));
  assert.equal(inputs(t), "orig");
});

test("cp29h one undo step, no step when nothing changed", () => {
  const s = createSheet();
  s.fromCSV("1,2\n3,4");
  assert.equal(s.undo(), true);
  assert.equal(s.toCSV(), "");
  assert.equal(s.undo(), false);
  assert.equal(s.redo(), true);
  assert.equal(s.toCSV(), "1,2\n3,4");
  const t = sheet({ A1: "1", B1: "2" });
  t.fromCSV("1,2");
  t.fromCSV("");
  t.fromCSV(",", "C5");
  assert.equal(t.undo(), true);
  assert.equal(inputs(t), "1");
  assert.equal(t.redo(), true);
  t.fromCSV("9");
  assert.equal(t.undo(), true);
  assert.equal(inputs(t), "1,2");
  assert.equal(t.redo(), true);
  t.undo();
  t.fromCSV("1");
  assert.equal(t.redo(), true);
  assert.equal(inputs(t), "9,2");
});

test("cp29h undo of an import re-evaluates only what it changed", () => {
  const s = sheet({ A1: "1", B1: "=A1*2", C1: "=10", D1: "=C1+1" });
  assert.deepEqual([s.get("B1"), s.get("D1")], [2, 11]);
  s.fromCSV("5");
  assert.equal(s.get("B1"), 10);
  const before = s.stats().evaluations;
  s.undo();
  assert.deepEqual([s.get("B1"), s.get("C1"), s.get("D1")], [2, 10, 11]);
  assert.equal(s.stats().evaluations - before, 1);
});
