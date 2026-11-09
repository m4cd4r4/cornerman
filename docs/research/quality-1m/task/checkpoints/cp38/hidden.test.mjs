// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell;
const canon = (input) => {
  const s = createSheet();
  s.set("A1", input);
  return s.canonical("A1");
};
const table = (rows) => {
  for (const [input, want] of rows) assert.equal(canon(input), want, input);
};

test("cp38h spaces, case, numbers, strings", () => {
  table([
    ["= 1 + 2 * 3", "=1+2*3"],
    ["=sum( a1:b2 , $c$1, c$1 )", "=SUM(A1:B2,$C$1,C$1)"],
    ["=true", "=TRUE"],
    ["=false&\"False\"", '=FALSE&"False"'],
    ["=rate*2", "=RATE*2"],
    ["=007.50 + 0.0 + 00", "=7.5+0+0"],
    ["=10.010", "=10.01"],
    ["=1000000000000000000000", "=1000000000000000000000"],
    ["=0.000000100", "=0.0000001"],
    ['="say ""hi"""', '="say ""hi"""'],
    ['=if(1>0,"Yes", "no ")', '=IF(1>0,"Yes","no ")'],
    ['="a b"&" "', '="a b"&" "'],
    ["=#REF!+1", "=#REF!+1"],
    ["=a0", "=A0"],
    ["=SUM()", "=SUM()"],
    ["=round(2.5,0)", "=ROUND(2.5,0)"],
    ["=a1:a2", "=A1:A2"],
    ["=$a1:B$2", "=$A1:B$2"],
  ]);
});

test("cp38h minimal parentheses", () => {
  table([
    ["=(1+2)*3", "=(1+2)*3"],
    ["=1-(2-3)", "=1-(2-3)"],
    ["=(1-2)-3", "=1-2-3"],
    ["=1/2*3", "=1/2*3"],
    ["=(1/2)/3", "=1/2/3"],
    ["=1/(2/3)", "=1/(2/3)"],
    ["=1/(2*3)", "=1/(2*3)"],
    ["=2^3^2", "=2^3^2"],
    ["=2^(3^2)", "=2^3^2"],
    ["=(2^3)^2", "=(2^3)^2"],
    ["=-2^2", "=-2^2"],
    ["=(-2)^2", "=(-2)^2"],
    ["=-(2^2)", "=-2^2"],
    ["=-(1+2)", "=-(1+2)"],
    ["=2^-1", "=2^-1"],
    ["=2^(-1)", "=2^-1"],
    ["=--1", "=--1"],
    ["=+1", "=+1"],
    ["=1--1", "=1--1"],
    ["=1-(-1)", "=1--1"],
    ["=1-+2", "=1-+2"],
    ["=2*-3", "=2*-3"],
    ["=(1+2)%", "=(1+2)%"],
    ["=(50%)%", "=50%%"],
    ["=(2^2)%", "=(2^2)%"],
    ["=1<2=TRUE", "=1<2=TRUE"],
    ["=1<(2=TRUE)", "=1<(2=TRUE)"],
    ['="a"&(1+2)', '="a"&1+2'],
    ['=("a"&"b")&"c"', '="a"&"b"&"c"'],
    ['="a"&("b"&"c")', '="a"&("b"&"c")'],
    ["=(1&2)=3", "=1&2=3"],
    ["=1&(2=3)", "=1&(2=3)"],
    ["=(((1)))", "=1"],
    ["=SUM((1+2),(3))", "=SUM(1+2,3)"],
    ["=(1+2)*(3-4)/(5^6)", "=(1+2)*(3-4)/5^6"],
  ]);
});

test("cp38h empty, text, unparseable, address errors, no side effects", () => {
  const s = createSheet();
  assert.equal(s.canonical("Z9"), "");
  assert.equal(s.canonical("z9"), "");
  for (const input of ["plain text", "  padded  ", "'=1+2", "Data!a1", "=1+", "=", "=SUM(1,", '="open', "=A1!B2", "=  1 +"]) {
    s.set("A1", input);
    assert.equal(s.canonical("a1"), input, input);
  }
  assert.throws(() => s.canonical("A0"), thrown("#ADDR", "A0"));
  assert.throws(() => s.canonical(5), thrown("#ADDR", 5));
  const t = createSheet();
  t.set("B1", "=1/0");
  t.set("A1", "=b1 + 1");
  assert.equal(t.canonical("A1"), "=B1+1");
  assert.equal(t.stats().evaluations, 0);
  assert.equal(t.getInput("A1"), "=b1 + 1");
  assert.equal(t.undo(), true);
  assert.equal(t.getInput("A1"), null);
  assert.equal(t.redo(), true);
  assert.equal(t.redo(), false);
});

test("cp38h sheet prefixes in a workbook", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.set("A1", "4");
  m.set("A1", "=sum(data!a1:B2) + Data!$a$1");
  m.set("A2", "=nope!a1");
  assert.equal(m.canonical("A1"), "=SUM(DATA!A1:B2)+DATA!$A$1");
  assert.equal(m.canonical("A2"), "=NOPE!A1");
  m.set("A3", m.canonical("A1"));
  assert.equal(m.get("A3"), m.get("A1"));
  assert.equal(m.get("A3"), 8);
});

test("cp38h generated formulas round trip", () => {
  let seed = 7;
  const rnd = (n) => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed % n);
  const atoms = ["1", "2.50", "0", "b1", "B2", "$B$1", "true", '"x"', "sum(B1:b2)", "(3)", "c9", "#REF!"];
  const ops = ["+", "-", "*", "/", "^", "&", "=", "<", ">=", "<>"];
  const gen = (d) => {
    const r = rnd(10);
    if (d > 3 || r < 3) return atoms[rnd(atoms.length)];
    if (r < 5) return (rnd(2) ? "-" : "+") + gen(d + 1);
    if (r < 6) return gen(d + 1) + "%";
    if (r < 8) return "( " + gen(d + 1) + ops[rnd(ops.length)] + gen(d + 1) + ")";
    return gen(d + 1) + " " + ops[rnd(ops.length)] + gen(d + 1);
  };
  const s = createSheet();
  s.set("B1", "3");
  s.set("B2", "4");
  let changed = 0;
  for (let i = 0; i < 1500; i++) {
    const f = "=" + gen(0);
    s.set("A1", f);
    const value = s.get("A1");
    const c = s.canonical("A1");
    if (c !== f) changed++;
    s.set("A1", c);
    assert.deepEqual(s.get("A1"), value, `${f} -> ${c}`);
    assert.equal(s.canonical("A1"), c, f);
    assert.equal(/ /.test(c.replace(/"[^"]*"/g, "")), false, c);
  }
  assert.ok(changed > 900);
});
