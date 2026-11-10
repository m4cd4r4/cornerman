// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
const inputs = (s) => Object.fromEntries(s.cells().map((k) => [k, s.getInput(k)]));

test("cp69h the delimiter replaces the comma everywhere", () => {
  const s = createSheet();
  s.fromCSV('a,b;c\n"x;y";"q""r"\n;', "A1", { delimiter: ";" });
  assert.deepEqual(inputs(s), { A1: "a,b", B1: "c", A2: "x;y", B2: 'q"r' });
  assert.throws(() => s.fromCSV('a\n"b",c', "D1", { delimiter: ";" }), thrown("#CSV", "2"));
  assert.throws(() => s.fromCSV('"b";c', "D1", { delimiter: "\t" }), thrown("#CSV", "1"));
  s.fromCSV('1\t"2\t3"\t \t', "A5", { delimiter: "\t" });
  assert.deepEqual(s.cells().filter((k) => k.endsWith("5")), ["A5", "B5", "C5"]);
  assert.equal(s.getInput("B5"), "2\t3");
  assert.equal(s.getInput("C5"), " ");
  s.fromCSV("p q  r", "A7", { delimiter: " " });
  assert.deepEqual([s.getInput("A7"), s.getInput("B7"), s.getInput("C7"), s.getInput("D7")], ["p", "q", null, "r"]);
});

test("cp69h the decimal option never changes how fields are read", () => {
  const s = createSheet({ decimal: "," });
  s.fromCSV("1,5;2.5;007", "A1", { delimiter: ";" });
  assert.equal(s.get("A1"), "1,5");
  assert.equal(s.get("B1"), 2.5);
  assert.equal(s.display("B1"), "2,5");
  assert.equal(s.get("C1"), 7);
  s.fromCSV("1,5", "A2");
  assert.equal(s.get("A2"), 1);
  assert.equal(s.get("B2"), 5);
});

test("cp69h header: returned, not written, the next record lands on at", () => {
  const s = createSheet();
  s.set("A1", "keep");
  const h = s.fromCSV("h1,,h3\nx\ny,z", "A1", { header: true });
  assert.deepEqual(h, ["h1", "", "h3"]);
  assert.deepEqual(inputs(s), { A1: "x", A2: "y", B2: "z" });
  assert.equal(s.fromCSV("", "A1", { header: true }), null);
  assert.equal(s.fromCSV("a", "C9", { header: false }), undefined);
  assert.equal(s.fromCSV("a", "C9"), undefined);
  assert.equal(s.fromCSV("only,header\n", "D1", { header: true }).join("|"), "only|header");
  assert.equal(s.getInput("D1"), null);
});

test("cp69h #CSV counts the header; #FULL counts only written records", () => {
  const s = createSheet();
  assert.throws(() => s.fromCSV('ok\n"bad', "A1", { header: true }), thrown("#CSV", "2"));
  assert.throws(() => s.fromCSV('"bad\nok', "A1", { header: true }), thrown("#CSV", "1"));
  assert.throws(() => s.fromCSV("h\n1\nx\"y", "A1", { header: true }), thrown("#CSV", "3"));
  s.fromCSV("head\nlast", "A9999", { header: true });
  assert.equal(s.getInput("A9999"), "last");
  assert.throws(() => s.fromCSV("head\na\nb", "A9999", { header: true }), thrown("#FULL", "A9999"));
  s.fromCSV("a,b,c\nx,y", "ZY5", { header: true });
  assert.equal(s.getInput("ZZ5"), "y");
});

test("cp69h a header-only text records nothing and fires nothing", () => {
  const s = createSheet();
  s.set("A1", "1");
  const seen = [];
  s.onChange((e) => seen.push(e.cells));
  s.fromCSV("x,y", "A1", { header: true });
  assert.deepEqual(seen, []);
  assert.equal(s.undo(), true);
  assert.equal(s.undo(), false);
  s.fromCSV("h\n5\n6", "B1", { header: true, delimiter: "|" });
  assert.deepEqual(seen, [["A1"], ["B1", "B2"]]);
  assert.equal(s.undo(), true);
  assert.deepEqual(s.cells(), []);
});

test("cp69h types text writes numbers and formulas as text formulas", () => {
  const s = createSheet();
  s.set("F1", "old");
  s.fromCSV('007,-2.5,=1+1,"=say ""hi""",TRUE, 5,1e5,5.,,x', "A1", { types: "text" });
  assert.deepEqual(inputs(s), { A1: '="007"', B1: '="-2.5"', C1: '="=1+1"', D1: '="=say ""hi"""', E1: "TRUE", F1: " 5", G1: "1e5", H1: "5.", J1: "x" });
  assert.equal(s.get("A1"), "007");
  assert.equal(s.get("B1"), "-2.5");
  assert.equal(s.get("C1"), "=1+1");
  assert.equal(s.get("D1"), '=say "hi"');
  assert.equal(s.get("E1"), "TRUE");
  s.set("K1", "=A1+1");
  assert.equal(s.get("K1").code, "#VALUE!");
  s.fromCSV("007", "A2", { types: "auto" });
  assert.equal(s.get("A2"), 7);
});

test("cp69h validation and limits check the input as written", () => {
  const s = createSheet();
  s.setValidation("A1:A3", { type: "whole", min: 1, max: 9 });
  assert.throws(() => s.fromCSV("5\n99", "A1"), thrown("#INVALID", "A2"));
  assert.throws(() => s.fromCSV("5\n99\nabc", "A1", { types: "text" }), thrown("#INVALID", "A3"));
  s.fromCSV("5\n99", "A1", { types: "text" });
  assert.equal(s.getInput("A1"), '="5"');
  assert.equal(s.getInput("A2"), '="99"');
  assert.deepEqual(s.invalidCells(), []);
  const digits = "1".repeat(998);
  s.fromCSV(digits, "C1");
  assert.equal(s.getInput("C1").length, 998);
  assert.throws(() => s.fromCSV(`x,${digits}`, "C2", { types: "text" }), thrown("#LIMIT", "D2"));
  s.fromCSV("1".repeat(997), "C3", { types: "text" });
  assert.equal(s.getInput("C3").length, 1000);
  s.merge("E1:F1");
  assert.throws(() => s.fromCSV("h\n1,2", "E1", { header: true }), thrown("#MERGE", "F1"));
});

test("cp69h option errors come after at and before the text", () => {
  const s = createSheet();
  for (const [at, opts, code, cell] of [
    ["A0", null, "#ADDR", "A0"],
    ["A1", null, "#ARG", "opts"],
    ["A1", [], "#ARG", "opts"],
    ["A1", "x", "#ARG", "opts"],
    ["A1", { delimiter: "" }, "#ARG", ""],
    ["A1", { delimiter: '"' }, "#ARG", '"'],
    ["A1", { delimiter: "\n" }, "#ARG", "\n"],
    ["A1", { delimiter: "\r" }, "#ARG", "\r"],
    ["A1", { delimiter: ";;" }, "#ARG", ";;"],
    ["A1", { delimiter: 5, header: "no" }, "#ARG", "5"],
    ["A1", { delimiter: null }, "#ARG", "null"],
    ["A1", { header: "yes", types: "x" }, "#ARG", "yes"],
    ["A1", { header: 1 }, "#ARG", "1"],
    ["A1", { header: null }, "#ARG", "null"],
    ["A1", { types: "Text" }, "#ARG", "Text"],
    ["A1", { types: null }, "#ARG", "null"],
  ]) {
    assert.throws(() => s.fromCSV(42, at, opts), thrown(code, cell), JSON.stringify([at, opts]));
  }
  assert.throws(() => s.fromCSV(42, "A1", { delimiter: undefined, header: undefined, types: undefined, other: 1 }), thrown("#ARG", "42"));
  assert.throws(() => s.fromCSV('"', "A1", { delimiter: ";", header: true, types: "text" }), thrown("#CSV", "1"));
  assert.deepEqual(s.cells(), []);
});

test("cp69h CHANGES.md has a cp69 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 69);
  assert.match(lines[68], /^- cp69: \S/);
  assert.notEqual(lines[68].slice(8).toLowerCase(), "csv import options");
});
