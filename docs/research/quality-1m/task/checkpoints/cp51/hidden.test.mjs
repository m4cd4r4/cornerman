// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;

test("cp51h * ? and ~ are ordinary characters", () => {
  const s = createSheet();
  s.setMany({ A1: "a*b", A2: "axb", A3: "a?b", A4: "ab", A5: "~*", A6: "*" });
  assert.deepEqual(s.find("*"), ["A1", "A5", "A6"]);
  assert.deepEqual(s.find("a*b"), ["A1"]);
  assert.deepEqual(s.find("a?b"), ["A3"]);
  assert.deepEqual(s.find("~*"), ["A5"]);
  assert.deepEqual(s.find("*", { whole: true }), ["A6"]);
  assert.equal(typeof s.replace("*", "-"), "number");
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((r) => s.getInput(`A${r}`)), ["a-b", "axb", "a?b", "ab", "~-", "-"]);
});

test("cp51h case: ignored unless matchCase; the replacement is written as given", () => {
  const s = createSheet();
  s.setMany({ A1: "Total", B1: "TOTAL due", C1: "subtotal", A2: "tot" });
  assert.deepEqual(s.find("TOTAL"), ["A1", "B1", "C1"]);
  assert.deepEqual(s.find("Total", { matchCase: true }), ["A1"]);
  assert.deepEqual(s.find("total", { whole: true }), ["A1"]);
  assert.deepEqual(s.find("total", { whole: true, matchCase: true }), []);
  assert.deepEqual(s.find("tot", { matchCase: false, whole: false, other: 1 }), ["A1", "B1", "C1", "A2"]);
  assert.equal(typeof s.replace("total", "Sum"), "number");
  assert.deepEqual(["A1", "B1", "C1"].map((k) => s.getInput(k)), ["Sum", "Sum due", "subSum"]);
  assert.equal(typeof s.replace("sum", "SUM", { matchCase: true }), "number");
  assert.equal(typeof s.replace("Sum due", "x", { whole: true }), "number");
  assert.equal(s.getInput("B1"), "x");
  assert.equal(typeof s.replace("TOT", "tot"), "number");
  assert.equal(typeof s.replace("tot", "TOT", { whole: true }), "number");
  assert.equal(s.getInput("A2"), "TOT");
});

test("cp51h inputs are searched as typed, never values", () => {
  const s = createSheet();
  s.set("A1", "1000");
  s.setFormat("A1", "#,##0");
  s.set("A2", "=1+1");
  s.set("A3", '="x"&"y"');
  s.setNote("B1", "find me");
  s.defineName("FINDME", "A1");
  assert.equal(s.display("A1"), "1,000");
  assert.deepEqual(s.find("1000"), ["A1"]);
  assert.deepEqual(s.find("1,000"), []);
  assert.deepEqual(s.find("1+"), ["A2"]);
  assert.deepEqual(s.find("2"), []);
  assert.deepEqual(s.find("xy"), []);
  assert.deepEqual(s.find("="), ["A2", "A3"]);
  assert.deepEqual(s.find("find"), []);
  assert.equal(typeof s.replace("=", ""), "number");
  assert.equal(s.get("A2"), "1+1");
  assert.equal(s.getInput("A3"), '"x"&"y"');
  assert.deepEqual(s.names(), { FINDME: "A1" });
  assert.equal(s.getNote("B1"), "find me");
});

test("cp51h covered cells are skipped; hidden rows and columns are searched", () => {
  const s = createSheet();
  s.setMany({ A1: "cat", B1: "cat", C1: "cat", A2: "cat", C3: "=B1&\"cat\"" });
  s.merge("A1:B1");
  s.hideRows(2);
  s.hideCols("C");
  assert.deepEqual(s.find("cat"), ["A1", "C1", "A2", "C3"]);
  assert.equal(typeof s.replace("cat", "dog"), "number");
  assert.equal(s.getInput("B1"), "cat");
  assert.equal(s.getInput("A2"), "dog");
  assert.equal(s.getInput("C3"), '=B1&"dog"');
  s.unmerge("A1");
  assert.equal(s.get("C3"), "catdog");
  assert.deepEqual(s.find("cat"), ["B1"]);
});

test("cp51h left to right, no overlap, no second pass", () => {
  const s = createSheet();
  s.setMany({ A1: "aaa", A2: "aa", A3: "abab", A4: "aaaa" });
  assert.equal(typeof s.replace("aa", "b"), "number");
  assert.deepEqual(["A1", "A2", "A3", "A4"].map((k) => s.getInput(k)), ["ba", "b", "abab", "bb"]);
  assert.equal(typeof s.replace("b", "bb"), "number");
  assert.deepEqual(["A1", "A2", "A3", "A4"].map((k) => s.getInput(k)), ["bba", "bb", "abbabb", "bbbb"]);
  assert.equal(typeof s.replace("bab", "X"), "number");
  assert.equal(s.getInput("A3"), "abXb");
});

test("cp51h the new input is as if typed: re-parsed, emptied, references are text", () => {
  const s = createSheet();
  s.setMany({ A1: "2", A10: "3", B1: "5", B10: "7", C1: "=A1+A10", C2: "x", C3: "=SUM(A1:A10)" });
  assert.equal(s.get("C1"), 5);
  assert.equal(typeof s.replace("A1", "B1"), "number");
  assert.equal(s.getInput("C1"), "=B1+B10");
  assert.equal(s.getInput("C3"), "=SUM(B1:B10)");
  assert.equal(s.get("C1"), 12);
  assert.equal(s.get("C3"), 12);
  assert.deepEqual(s.precedents("C1"), ["B1", "B10"]);
  assert.equal(typeof s.replace("x", ""), "number");
  assert.equal(s.getInput("C2"), null);
  assert.deepEqual(s.cells(), ["A1", "B1", "C1", "C3", "A10", "B10"]);
  assert.equal(typeof s.replace("2", "=1+"), "number");
  assert.equal(s.getInput("A1"), "=1+");
  assert.equal(s.get("A1").code, "#PARSE!");
});

test("cp51c chat: replace returns the cells changed, not the occurrences", () => {
  const s = createSheet();
  s.setMany({ A1: "x x x", B1: "xx", C1: "y" });
  assert.equal(s.replace("x", "z"), 2);
  assert.equal(s.getInput("A1"), "z z z");
  assert.equal(s.replace("Z", "z"), 0);
  assert.equal(s.getInput("A1"), "z z z");
  assert.equal(s.replace("Z", "Z"), 2);
  assert.equal(s.getInput("B1"), "ZZ");
});

test("cp51h validation is checked first, in row-major order", () => {
  const s = createSheet();
  s.setMany({ A1: "3", B1: "13", A2: "30", B2: "3" });
  s.setValidation("A1:A2", { type: "whole", min: 1, max: 9 });
  s.setValidation("B2", { type: "list", items: ["3", "4"] });
  assert.throws(() => s.replace("3", "4"), thrown("#INVALID", "A2"));
  assert.deepEqual(["A1", "B1", "A2", "B2"].map((k) => s.getInput(k)), ["3", "13", "30", "3"]);
  assert.throws(() => s.replace("3", "x"), thrown("#INVALID", "A1"));
  assert.equal(typeof s.replace("3", "=4"), "number");
  assert.equal(s.get("A2"), 40);
  assert.equal(s.undo(), true);
  assert.equal(s.getInput("A2"), "30");
  assert.equal(typeof s.replace("1", ""), "number");
  assert.equal(s.getInput("B1"), "3");
});

test("cp51h one undo step per replace that changes something", () => {
  const s = createSheet();
  s.setMany({ A1: "a", A2: "ab", A3: "c" });
  s.set("A3", "ca");
  assert.equal(typeof s.replace("a", "z"), "number");
  assert.equal(typeof s.replace("q", "z"), "number");
  assert.equal(typeof s.replace("z", "z"), "number");
  assert.equal(s.undo(), true);
  assert.deepEqual(["A1", "A2", "A3"].map((k) => s.getInput(k)), ["a", "ab", "ca"]);
  assert.equal(s.undo(), true);
  assert.equal(s.getInput("A3"), "c");
  assert.equal(s.redo(), true);
  assert.equal(s.redo(), true);
  assert.deepEqual(["A1", "A2", "A3"].map((k) => s.getInput(k)), ["z", "zb", "cz"]);
  const before = s.stats().evaluations;
  s.set("B1", "=A1&A2");
  assert.deepEqual(s.find("a"), ["B1"]);
  assert.equal(s.stats().evaluations, before);
});

test("cp51h argument errors, in order, change nothing", () => {
  const s = createSheet();
  s.set("A1", "x");
  assert.throws(() => s.find(""), thrown("#ARG", ""));
  assert.throws(() => s.find(5), thrown("#ARG", "5"));
  assert.throws(() => s.find(null, null), thrown("#ARG", "null"));
  assert.throws(() => s.find("x", null), thrown("#ARG", "opts"));
  assert.throws(() => s.find("x", []), thrown("#ARG", "opts"));
  assert.throws(() => s.find("x", { whole: 1 }), thrown("#ARG", "opts"));
  assert.throws(() => s.find("x", "whole"), thrown("#ARG", "opts"));
  assert.throws(() => s.replace(5, 7, null), thrown("#ARG", "5"));
  assert.throws(() => s.replace("x", 7, null), thrown("#ARG", "7"));
  assert.throws(() => s.replace("x", undefined), thrown("#ARG", "undefined"));
  assert.throws(() => s.replace("x", "y", { matchCase: "yes" }), thrown("#ARG", "opts"));
  assert.equal(s.getInput("A1"), "x");
  assert.equal(typeof s.replace("x", "", {}), "number");
  assert.equal(s.getInput("A1"), null);
});

test("cp51h per sheet; other sheets see the new values", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.set("A1", "4");
  d.set("A2", "9");
  m.set("A1", "=Data!A1*2");
  m.set("A2", "Data");
  assert.equal(m.get("A1"), 8);
  assert.equal(typeof d.replace("4", "5"), "number");
  assert.equal(m.get("A1"), 10);
  assert.deepEqual(d.find("data"), []);
  assert.equal(typeof m.replace("Data!A1", "Data!A2"), "number");
  assert.equal(m.get("A1"), 18);
  assert.equal(typeof m.replace("data", "Facts"), "number");
  assert.equal(m.getInput("A1"), "=Facts!A2*2");
  assert.equal(m.get("A1").code, "#REF!");
  assert.deepEqual(b.sheetNames(), ["Main", "Data"]);
});

test("cp51h CHANGES.md has a cp51 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 51);
  assert.match(lines[50], /^- cp51: \S/);
  assert.notEqual(lines[50].slice(8).toLowerCase(), "find and replace");
});

test("cp51h recall: find lists addresses in the order cells() gives, row by row with Z before AA", () => {
  const s = createSheet();
  s.setMany({ B2: "x", A10: "x", AA1: "x", A2: "x", Z1: "x" });
  assert.deepEqual(s.find("x"), ["Z1", "AA1", "A2", "B2", "A10"]);
  assert.deepEqual(s.find("x"), s.cells());
});
