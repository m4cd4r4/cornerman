// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const err = (v) => (v && typeof v === "object" ? `${v.code}@${v.cell}` : v);
function val(f, setup = {}, opts) {
  const s = createSheet(opts);
  for (const [k, v] of Object.entries(setup)) s.set(k, v);
  s.set("G7", f);
  return err(s.get("G7"));
}

test("cp61h FIND matches with case, from start", () => {
  assert.equal(val('=FIND("a", "bAnana")'), 4);
  assert.equal(val('=FIND("A", "bAnana")'), 2);
  assert.equal(val('=FIND("an", "banana", 3)'), 4);
  assert.equal(val('=FIND("an", "banana", 5)'), "#N/A@G7");
  assert.equal(val('=FIND("a", "aXa", 2.9)'), 3);
  assert.equal(val('=FIND("a*", "xa*")'), 2);
  assert.equal(val('=FIND("?", "ab?")'), 3);
  assert.equal(val('=FIND("a?", "abc")'), "#N/A@G7");
  assert.equal(val('=FIND("z", "abc")'), "#N/A@G7");
  assert.equal(val('=FIND("B", "abc")'), "#N/A@G7");
});

test("cp61h an empty find gives start; start must be inside the text or just past it", () => {
  assert.equal(val('=FIND("", "abc")'), 1);
  assert.equal(val('=FIND("", "abc", 4)'), 4);
  assert.equal(val('=SEARCH("", "abc", 3)'), 3);
  assert.equal(val('=FIND("", A1)'), 1);
  assert.equal(val('=SEARCH("*", A1)'), 1);
  assert.equal(val('=FIND("c", "abc", 3)'), 3);
  for (const f of ['=FIND("", "abc", 5)', '=FIND("a", "abc", 0)', '=FIND("a", "abc", 0.5)', '=SEARCH("a", "abc", -1)', '=SEARCH("", "", 2)', '=FIND("a", "abc", 9)']) {
    assert.equal(val(f), "#VALUE!@G7", f);
  }
  assert.equal(val('=FIND("a", A1)'), "#N/A@G7");
  assert.equal(val('=FIND("a", "abc", A1)'), "#VALUE!@G7");
});

test("cp61h SEARCH ignores case and reads ? and *", () => {
  assert.equal(val('=SEARCH("world", "Hello WORLD")'), 7);
  assert.equal(val('=SEARCH("b?d", "abcd")'), 2);
  assert.equal(val('=SEARCH("b?d", "abd")'), "#N/A@G7");
  assert.equal(val('=SEARCH("a*c", "xxABCx")'), 3);
  assert.equal(val('=SEARCH("a*c", "xxacx")'), 3);
  assert.equal(val('=SEARCH("*c", "abc")'), 1);
  assert.equal(val('=SEARCH("*c", "abc", 2)'), 2);
  assert.equal(val('=SEARCH("?", "abc", 3)'), 3);
  assert.equal(val('=SEARCH("??", "abc", 3)'), "#N/A@G7");
  assert.equal(val('=SEARCH("c*", "abc")'), 3);
  assert.equal(val('=SEARCH("x*y", "x\ny")'), 1);
});

test("cp61h SEARCH has no escape; other characters stand for themselves", () => {
  assert.equal(val('=SEARCH("~?", "a?b")'), "#N/A@G7");
  assert.equal(val('=SEARCH("~?", "x~yz")'), 2);
  assert.equal(val('=SEARCH("~*", "a*b~")'), 4);
  assert.equal(val('=SEARCH("~~", "a~~b")'), 2);
  assert.equal(val('=SEARCH("~", "a~b")'), 2);
  assert.equal(val('=SEARCH(".", "abc.")'), 4);
  assert.equal(val('=SEARCH("(", "a(b")'), 2);
  assert.equal(val('=SEARCH("[A]", "x[a]")'), 2);
  assert.equal(val('=SEARCH("$", "a$")'), 2);
  assert.equal(val('=SEARCH("a+", "aa+")'), 2);
  assert.equal(val('=SEARCH("\\d", "1\\D")'), 2);
  assert.equal(val('=SEARCH("^a", "b^A")'), 2);
});

test("cp61h not found is #N/A, in the priority order", () => {
  assert.equal(val('=FIND("z", "abc") + 1/0'), "#N/A@G7");
  assert.equal(val('=FIND("z", "abc") & nope'), "#NAME?@G7");
  assert.equal(val('=1/0 + SEARCH("z", "abc")', {}, { errorOrder: "first" }), "#DIV/0!@G7");
  assert.equal(val('=IFERROR(SEARCH("z", "abc"), 0)'), 0);
  assert.equal(val('=ISERROR(FIND("z", "abc"))'), true);
  assert.equal(val('=IF(ISERROR(FIND("@", A1)), "no", "yes")', { A1: "me@x" }), "yes");
  assert.equal(val('=FIND(A1, "abc")', { A1: "=1/0" }), "#DIV/0!@A1");
  assert.equal(val('=FIND(1/0, nope, 99)'), "#NAME?@G7");
  assert.equal(val('=SEARCH("a", "b", 1/0)'), "#DIV/0!@G7");
});

test("cp61h values are read as display text", () => {
  assert.equal(val('=FIND(".", 1/4)'), 2);
  assert.equal(val('=FIND("3", 0.1+0.2)'), 3);
  assert.equal(val('=FIND("#", 10^15)'), 1);
  assert.equal(val('=FIND(4, 1234.5)'), 4);
  assert.equal(val('=FIND("T", TRUE)'), 1);
  assert.equal(val('=SEARCH("rue", 1=1)'), 2);
  assert.equal(val('=FIND("7", A1)', { A1: "007" }), 1);
  assert.equal(val('=FIND("0", A1)', { A1: "007" }), "#N/A@G7");
  assert.equal(val('=FIND("0", A1)', { A1: '="007"' }), 1);
  assert.equal(val('=SUBSTITUTE(1234, 3, 9)'), "1294");
  assert.equal(val('=SUBSTITUTE(1234, 3, 9) + 1'), "#VALUE!@G7");
  assert.equal(val('=SUBSTITUTE(0.1+0.2, "0.", "")'), "3");
  assert.equal(val('=SUBSTITUTE(TRUE, "T", "")'), "RUE");
  assert.equal(val('=SUBSTITUTE(A1, "", "x")'), "");
});

test("cp61h SUBSTITUTE: case, left to right, instance", () => {
  assert.equal(val('=SUBSTITUTE("aAa", "a", "x")'), "xAx");
  assert.equal(val('=SUBSTITUTE("aaaa", "aa", "X")'), "XX");
  assert.equal(val('=SUBSTITUTE("aaa", "aa", "X")'), "Xa");
  assert.equal(val('=SUBSTITUTE("aaaa", "aa", "X", 2)'), "aaX");
  assert.equal(val('=SUBSTITUTE("aaaa", "aa", "X", 3)'), "aaaa");
  assert.equal(val('=SUBSTITUTE("abab", "b", "", 1.9)'), "aab");
  assert.equal(val('=SUBSTITUTE("a-b-c", "-", "+", 2)'), "a-b+c");
  assert.equal(val('=SUBSTITUTE("a*b?", "*", "?")'), "a?b?");
  assert.equal(val('=SUBSTITUTE("abc", "", "x")'), "abc");
  assert.equal(val('=SUBSTITUTE("abc", "", "x", 1)'), "abc");
  assert.equal(val('=SUBSTITUTE("abc", "b", "bb")'), "abbc");
  assert.equal(val('=SUBSTITUTE("abc", "B", "x")'), "abc");
  assert.equal(val('=SUBSTITUTE("abc", "b", "x", 0)'), "#VALUE!@G7");
  assert.equal(val('=SUBSTITUTE("abc", "b", "x", -1)'), "#VALUE!@G7");
  assert.equal(val('=SUBSTITUTE("abc", "z", "x", 0)'), "#VALUE!@G7");
  assert.equal(val('=SUBSTITUTE("abc", "b", "x", 0.5)'), "#VALUE!@G7");
});

test("cp61h argument counts and ranges", () => {
  for (const f of ['=SUBSTITUTE("a", "b")', '=SUBSTITUTE("a", "b", "c", 1, 2)', '=FIND("a")', '=FIND("a", "b", 1, 2)', '=SEARCH()', '=SEARCH("a", A1:A2)', '=FIND(A1:A2, "a")', '=SUBSTITUTE(A1:A2, "a", "b")', '=FIND("a", "abc", A1:A2)', '=SUBSTITUTE("a", "a", "b", "1")']) {
    assert.equal(val(f), "#VALUE!@G7", f);
  }
});

test("cp61h criteria functions and find and replace keep plain text", () => {
  const s = createSheet();
  s.fromCSV("a*\nabc\naXc\n?", "A1");
  s.set("B1", '=COUNTIF(A1:A4, "a*")');
  s.set("B2", '=COUNTIF(A1:A4, "?")');
  s.set("B3", '=SEARCH("a*", A2)');
  s.set("B4", '=SUM(IFERROR(SEARCH("a?c", A1), 0), IFERROR(SEARCH("a?c", A2), 0), IFERROR(SEARCH("a?c", A3), 0))');
  assert.equal(s.get("B1"), 1);
  assert.equal(s.get("B2"), 1);
  assert.equal(s.get("B3"), 1);
  assert.equal(s.get("B4"), 2);
  assert.equal(s.replace("a*", "z"), 3);
  assert.equal(s.getInput("B1"), '=COUNTIF(A1:A4, "z")');
  assert.equal(s.getInput("A1"), "z");
  assert.equal(s.getInput("B3"), '=SEARCH("z", A2)');
  assert.equal(err(s.get("B3")), "#N/A@B3");
});

test("cp61h references move; names, constants and other sheets", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.set("A1", "Total: 42");
  m.defineConstant("SEP", ": ");
  m.set("A1", "=MID(Data!A1, FIND(SEP, Data!A1) + LEN(SEP), 99)");
  m.set("A2", '=SUBSTITUTE(Data!A1, "Total", "Sum")');
  assert.equal(m.get("A1"), "42");
  assert.equal(m.get("A2"), "Sum: 42");
  assert.deepEqual(m.precedents("A1"), ["Data!A1"]);
  d.set("A1", "Total 42");
  assert.equal(err(m.get("A1")), "#N/A@A1");
  m.defineConstant("SEP", " ");
  assert.equal(m.get("A1"), "42");
  m.set("B1", "abc");
  m.set("C1", '=FIND("c", B1)');
  m.insertCols("B");
  assert.equal(m.getInput("D1"), '=FIND("c", C1)');
  m.copy("D1", "D2");
  assert.equal(m.getInput("D2"), '=FIND("c", C2)');
  assert.equal(err(m.get("D2")), "#N/A@D2");
  b.renameSheet("Data", "Info");
  assert.equal(m.getInput("A2"), '=SUBSTITUTE(Info!A1, "Total", "Sum")');
});

test("cp61h CHANGES.md has a cp61 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 61);
  assert.match(lines[60], /^- cp61: \S/);
  assert.notEqual(lines[60].slice(8).toLowerCase(), "substitute, find and search");
});

test("cp61h recall: an error read from another sheet keeps its own cell, with no sheet name", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.set("C5", "=1/0");
  m.set("B2", '=FIND("a", Data!C5)');
  assert.equal(err(m.get("B2")), "#DIV/0!@C5");
});
