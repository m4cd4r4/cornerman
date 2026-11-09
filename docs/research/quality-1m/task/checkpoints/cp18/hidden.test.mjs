// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

const isErr = (v, code, cell) => v && typeof v === "object" && v.code === code && v.cell === cell && typeof v.message === "string" && v.message.length > 0;
function val(f, setup = {}) {
  const s = createSheet();
  for (const [k, v] of Object.entries(setup)) s.set(k, v);
  s.set("Z99", f);
  return s.get("Z99");
}

test("cp18h the text argument is the display text", () => {
  assert.equal(val("=LEN(0.1+0.2)"), 3);
  assert.equal(val("=LEN(1/3)"), 8);
  assert.equal(val("=LEN(TRUE)"), 4);
  assert.equal(val("=LOWER(FALSE)"), "false");
  assert.equal(val("=LEN(B1)"), 0);
  assert.equal(val("=UPPER(1/4)"), "0.25");
  assert.equal(val("=LEFT(123, 2)"), "12");
  assert.equal(val("=LEFT(B1, 2)", { B1: "-7" }), "-7");
});

test("cp18h TRIM strips the ends only and keeps inner runs", () => {
  assert.equal(val('=TRIM("  a  b ")'), "a  b");
  assert.equal(val('=TRIM("x   y")'), "x   y");
  assert.equal(val('=TRIM("     ")'), "");
  assert.equal(val('=TRIM(" a\t")'), "a\t");
  assert.equal(val("=TRIM(B1)", { B1: "  word  " }), "word");
});

test("cp18h LEFT and RIGHT counts", () => {
  assert.equal(val('=LEFT("abc")'), "a");
  assert.equal(val('=RIGHT("abc")'), "c");
  assert.equal(val('=LEFT("abc", 0)'), "");
  assert.equal(val('=RIGHT("abc", 0)'), "");
  assert.equal(val('=LEFT("abc", 10)'), "abc");
  assert.equal(val('=RIGHT("abc", 10)'), "abc");
  assert.equal(val('=LEFT("abcd", 1.9)'), "a");
  assert.equal(val('=RIGHT("abcd", 2.9)'), "cd");
  assert.equal(val('=LEFT("abc", -0.5)'), "");
  assert.ok(isErr(val('=LEFT("abc", -1)'), "#VALUE!", "Z99"));
  assert.ok(isErr(val('=RIGHT("abc", -1)'), "#VALUE!", "Z99"));
});

test("cp18h MID positions", () => {
  assert.equal(val('=MID("abcdef", 2, 3)'), "bcd");
  assert.equal(val('=MID("abc", 5, 2)'), "");
  assert.equal(val('=MID("abc", 3, 5)'), "c");
  assert.equal(val('=MID("abc", 1.9, 1)'), "a");
  assert.equal(val('=MID("abc", 1, 0)'), "");
  assert.ok(isErr(val('=MID("abc", 0, 1)'), "#VALUE!", "Z99"));
  assert.ok(isErr(val('=MID("abc", 0.9, 1)'), "#VALUE!", "Z99"));
  assert.ok(isErr(val('=MID("abc", 1, -1)'), "#VALUE!", "Z99"));
});

test("cp18h argument counts", () => {
  for (const f of ["=LEN()", '=LEN("a", "b")', '=UPPER()', '=TRIM("a", 1)', "=LEFT()", '=RIGHT("a", 1, 2)', '=MID("a", 1)', '=MID("a", 1, 1, 1)']) {
    assert.ok(isErr(val(f), "#VALUE!", "Z99"), f);
  }
});

test("cp18h argument values: ranges, text counts, booleans, errors", () => {
  assert.ok(isErr(val("=LEN(B1:B2)"), "#VALUE!", "Z99"));
  assert.ok(isErr(val('=LEFT("abc", B1:B2)'), "#VALUE!", "Z99"));
  assert.ok(isErr(val('=LEFT("abc", "2")'), "#VALUE!", "Z99"));
  assert.equal(val('=LEFT("abc", TRUE)'), "a");
  assert.equal(val('=LEFT("abc", B1)'), "");
  assert.ok(isErr(val("=LEN(1/0)"), "#DIV/0!", "Z99"));
  assert.ok(isErr(val("=LEFT(1/0, FOO())"), "#NAME?", "Z99"));
  assert.ok(isErr(val("=UPPER(B2)", { B2: "=1/0" }), "#DIV/0!", "B2"));
});

test("cp18h case and length follow JavaScript", () => {
  assert.equal(val('=UPPER("aBc")'), "ABC");
  assert.equal(val('=LOWER("ÀB")'), "àb");
  assert.equal(val('=LEN("é")'), 1);
  assert.equal(val('=LEN("😀")'), 2);
  assert.equal(val('=UPPER("ß")'), "SS");
});
