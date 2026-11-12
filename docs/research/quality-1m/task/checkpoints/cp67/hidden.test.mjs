// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook, loadSheet, loadWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
const err = (v) => (v && typeof v === "object" ? `${v.code}@${v.cell}` : v);
const limit = (cell) => thrown("#LIMIT", cell);
// "=1+1+...+1" of exactly n characters (n even), worth n / 2.
const sum = (n) => "=1" + "+1".repeat((n - 2) / 2);
const deep = (n, inner = "1") => "=" + "(".repeat(n) + inner + ")".repeat(n);
// A formula of exactly n characters reading `ref`: =ref+1+1+...+1 padded with spaces.
function reading(ref, n) {
  let f = `=${ref}`;
  while (f.length + 2 <= n) f += "+1";
  return f + " ".repeat(n - f.length);
}

test("cp67h length counts the = and every space", () => {
  const s = createSheet();
  s.set("A1", sum(1000));
  assert.equal(s.get("A1"), 500);
  s.set("A2", "=" + " ".repeat(997) + "42");
  assert.equal(s.get("A2"), 42);
  assert.throws(() => s.set("A3", "=" + " ".repeat(998) + "42"), limit("A3"));
  assert.throws(() => s.set("a4", sum(1002)), limit("A4"));
  assert.throws(() => s.setCell("A5", sum(1000) + " "), limit("A5"));
  s.set("B1", "x".repeat(5000));
  s.set("B2", "1".repeat(1500));
  s.set("B3", " =" + "1".repeat(1500));
  assert.equal(s.getInput("B1").length, 5000);
  assert.deepEqual(s.cells(), ["A1", "B1", "A2", "B2", "B3"]);
});

test("cp67h grouping parentheses count as deeply as function calls", () => {
  const s = createSheet();
  s.set("A1", deep(16));
  s.set("A2", "=SUM(" + "MAX(".repeat(14) + "(-3)" + ")".repeat(14) + ")");
  assert.equal(s.get("A2"), -3);
  assert.throws(() => s.set("A3", "=SUM(" + "MAX(".repeat(15) + "(-3)" + ")".repeat(15) + ")"), limit("A3"));
  assert.throws(() => s.set("A4", "=SUM(" + "(".repeat(16) + "1" + ")".repeat(16) + ")"), limit("A4"));
  s.set("A5", "=(1)+(2)+" + "(".repeat(16) + "3" + ")".repeat(16));
  assert.equal(s.get("A5"), 6);
  assert.throws(() => s.set("A6", "=1+" + deep(17).slice(1)), limit("A6"));
});

test("cp67h parentheses in strings do not count; stray ) is ignored", () => {
  const s = createSheet();
  s.set("A1", '=LEN("' + "(".repeat(40) + '")');
  assert.equal(s.get("A1"), 40);
  s.set("A2", '=LEN("a""' + "(".repeat(30) + '")');
  assert.equal(s.get("A2"), 32);
  s.set("A3", '="' + "(".repeat(30));
  assert.equal(err(s.get("A3")), "#PARSE!@A3");
  assert.throws(() => s.set("A4", '=""&' + deep(17).slice(1)), limit("A4"));
  s.set("A5", "=" + ")".repeat(5) + "(".repeat(16));
  assert.equal(err(s.get("A5")), "#PARSE!@A5");
  assert.throws(() => s.set("A6", "=" + ")".repeat(3) + "(".repeat(17)), limit("A6"));
  s.set("A7", "=" + "(1)".repeat(300));
  assert.equal(err(s.get("A7")), "#PARSE!@A7");
});

test("cp67h a formula that does not parse is checked too", () => {
  const s = createSheet();
  assert.throws(() => s.set("A1", "=" + "(".repeat(17)), limit("A1"));
  assert.throws(() => s.set("A2", "=" + "+".repeat(1000)), limit("A2"));
  assert.equal(s.getInput("A1"), null);
  s.set("A3", "=" + "(".repeat(16));
  assert.equal(err(s.get("A3")), "#PARSE!@A3");
});

test("cp67h setMany checks every cell first, merge before limit", () => {
  const s = createSheet();
  s.setValidation("A1", { type: "list", items: ["ok"] });
  s.merge("C1:D1");
  assert.throws(() => s.setMany({ B1: sum(1002), A1: "bad" }), limit("B1"));
  assert.throws(() => s.setMany({ A1: "bad", B1: sum(1002) }), thrown("#INVALID", "A1"));
  assert.throws(() => s.setMany({ E1: "1", D1: sum(1002) }), thrown("#MERGE", "D1"));
  assert.throws(() => s.setMany({ E1: "1", e2: deep(17) }), limit("E2"));
  assert.deepEqual(s.cells(), []);
  s.setMany({ A1: deep(16), B1: sum(1000) });
  assert.equal(s.get("A1"), 1);
});

test("cp67h fromCSV checks every field before writing, row-major", () => {
  const s = createSheet();
  const long = sum(1002);
  assert.throws(() => s.fromCSV(`a,b\nc,"${long}"\n"${deep(17)}"`, "B2"), limit("C3"));
  assert.throws(() => s.fromCSV(`a,b\nc,d\n${deep(20)}`, "B2"), limit("B4"));
  assert.deepEqual(s.cells(), []);
  s.fromCSV(`"${sum(1000)}",${"y".repeat(2000)}`);
  assert.equal(s.get("A1"), 500);
});

test("cp67h fill checks what it writes; copy does not", () => {
  const s = createSheet();
  s.set("B9", "5");
  s.set("B10", "6");
  const f = reading("B9", 1000);
  s.set("A1", f);
  assert.equal(s.get("A1"), 503);
  assert.throws(() => s.fillDown("A1:A3"), limit("A2"));
  assert.equal(s.getInput("A2"), null);
  s.copy("A1", "A2");
  assert.equal(s.getInput("A2").length, 1001);
  assert.equal(s.get("A2"), s.get("A1") + 1);
  assert.throws(() => s.set("A2", s.getInput("A2")), limit("A2"));
  s.set("A2", "");
  s.set("C1", reading("B1", 1000));
  s.fillRight("C1:E1");
  assert.equal(s.getInput("E1"), reading("D1", 1000));
});

test("cp67h replace checks every new input, row-major", () => {
  const s = createSheet();
  s.set("A1", "=x");
  s.set("B1", deep(16, "x"));
  s.set("A2", sum(998) + "+x");
  assert.throws(() => s.replace("x", "(9)"), limit("B1"));
  assert.throws(() => s.replace("x", "99"), limit("A2"));
  assert.equal(s.getInput("A1"), "=x");
  assert.equal(typeof s.replace("x", "9"), "number");
  assert.equal(s.get("A2"), 508);
  assert.equal(s.get("B1"), 9);
});

test("cp67h insert, rename, sort, undo and loading keep over-limit formulas", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("D");
  d.set("A1", "4");
  m.set("A9", "3");
  m.set("A1", reading("A9", 1000));
  m.set("B1", reading("D!A1", 1000));
  m.insertRows(1);
  assert.equal(m.getInput("A2").length, 1001);
  assert.equal(m.get("A2"), 501);
  m.undo();
  assert.equal(m.getInput("A1"), reading("A9", 1000));
  m.redo();
  assert.equal(m.getInput("A2").length, 1001);
  b.renameSheet("D", "Data");
  assert.equal(m.getInput("B2").length, 1003);
  assert.equal(m.getInput("B2").startsWith("=Data!A1+1"), true);
  assert.equal(m.get("B2"), 501);
  m.sort("A1:B3", "A");
  assert.equal(m.getInput("A1").length, 1001);
  assert.equal(m.get("A1"), 501);
  const c = loadWorkbook(b.save());
  assert.equal(c.sheet("Main").getInput("B1").length, 1003);
  assert.equal(c.sheet("Main").get("B1"), 501);
  const big = "=" + "(".repeat(30) + "2" + ")".repeat(30) + "+1".repeat(600);
  const s = loadSheet(JSON.stringify({ format: "sheet", version: 1, cells: { A1: big }, names: {} }));
  assert.equal(s.get("A1"), 602);
  s.copy("A1", "B1");
  assert.equal(s.get("B1"), 602);
});

test("cp67h refused writes fire no event and leave undo alone", () => {
  const s = createSheet();
  s.set("A1", "1");
  const seen = [];
  s.onChange((e) => seen.push(e.cells));
  assert.throws(() => s.setMany({ A2: "2", A3: deep(17) }), limit("A3"));
  assert.deepEqual(seen, []);
  assert.equal(s.undo(), true);
  assert.equal(s.undo(), false);
});

test("cp67h CHANGES.md has a cp67 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 67);
  assert.match(lines[66], /^- cp67: \S/);
  assert.notEqual(lines[66].slice(8).toLowerCase(), "formula limits");
});
