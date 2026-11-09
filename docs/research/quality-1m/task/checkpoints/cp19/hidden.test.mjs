// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

const isErr = (v, code, cell) => v && typeof v === "object" && v.code === code && v.cell === cell && typeof v.message === "string" && v.message.length > 0;
function sheet(setup = {}) {
  const s = createSheet();
  for (const [k, v] of Object.entries(setup)) s.set(k, v);
  return s;
}
function val(f, setup = {}) {
  const s = sheet(setup);
  s.set("Z99", f);
  return s.get("Z99");
}
const serial = (y, m, d) => (Date.UTC(y, m - 1, d) - Date.UTC(2000, 0, 1)) / 86400000 + 1;

test("cp19h serials count from 2000-01-01 as 1", () => {
  assert.equal(val("=DATE(2000, 1, 2)"), 2);
  assert.equal(val("=DATE(2000, 12, 31)"), 366);
  assert.equal(val("=DATE(2001, 1, 1)"), 367);
  assert.equal(val("=DATE(2024, 3, 1)"), serial(2024, 3, 1));
  assert.equal(val("=DATE(9999, 12, 31)"), 2921940);
});

test("cp19h leap years are Gregorian", () => {
  assert.equal(val("=DATE(2000, 2, 29)"), 60);
  assert.equal(val("=DATE(2004, 2, 29)"), serial(2004, 2, 29));
  assert.equal(val("=DATE(2400, 2, 29)"), serial(2400, 2, 29));
  assert.ok(isErr(val("=DATE(2100, 2, 29)"), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=DATE(2001, 2, 29)"), "#VALUE!", "Z99"));
});

test("cp19h out-of-range parts are errors, never rolled over", () => {
  for (const f of ["=DATE(2000, 13, 1)", "=DATE(2000, 0, 1)", "=DATE(2000, 1, 0)", "=DATE(2000, 4, 31)", "=DATE(1999, 12, 31)", "=DATE(10000, 1, 1)", "=DATE(2000, 1, 32)", "=DATE(2000, -1, 1)"]) {
    assert.ok(isErr(val(f), "#VALUE!", "Z99"), f);
  }
});

test("cp19h arguments are truncated toward zero", () => {
  assert.equal(val("=DATE(2000.9, 1.9, 1.9)"), 1);
  assert.equal(val("=DATE(2000, 2, 29.7)"), 60);
  assert.equal(val("=YEAR(1.9)"), 2000);
  assert.equal(val("=DAY(60.99)"), 29);
  assert.ok(isErr(val("=YEAR(0.5)"), "#VALUE!", "Z99"));
});

test("cp19h YEAR, MONTH, DAY take dates apart", () => {
  for (const [y, m, d] of [[2000, 1, 1], [2000, 2, 29], [2000, 12, 31], [2023, 7, 4], [2100, 3, 1], [9999, 12, 31]]) {
    const s = serial(y, m, d);
    assert.equal(val(`=YEAR(${s})`), y, `${y}-${m}-${d}`);
    assert.equal(val(`=MONTH(${s})`), m, `${y}-${m}-${d}`);
    assert.equal(val(`=DAY(${s})`), d, `${y}-${m}-${d}`);
  }
  assert.equal(val("=MONTH(B1)", { B1: "367" }), 1);
});

test("cp19h serials must be 1 to 2921940", () => {
  assert.ok(isErr(val("=YEAR(0)"), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=YEAR(B1)"), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=DAY(-1)"), "#VALUE!", "Z99"));
  assert.ok(isErr(val("=MONTH(2921941)"), "#VALUE!", "Z99"));
  assert.equal(val("=YEAR(2921940)"), 9999);
});

test("cp19h argument rules", () => {
  for (const f of ["=DATE(2000, 1)", "=DATE(2000, 1, 1, 1)", "=YEAR()", "=YEAR(1, 2)", '=DATE("2000", 1, 1)', "=YEAR(B1:B2)", "=DATE(TRUE, 1, 1)", '=DAY("5")']) {
    assert.ok(isErr(val(f), "#VALUE!", "Z99"), f);
  }
  assert.ok(isErr(val("=DATE(1/0, FOO(), 1)"), "#NAME?", "Z99"));
  assert.ok(isErr(val("=YEAR(B1)", { B1: "=1/0" }), "#DIV/0!", "B1"));
});

test("cp19h dates are plain numbers", () => {
  assert.equal(val("=DATE(2024, 3, 1) - DATE(2024, 2, 1)"), 29);
  assert.equal(val("=DATE(2023, 3, 1) - DATE(2023, 2, 1)"), 28);
  const s = sheet();
  s.set("Z99", "=DATE(2024, 3, 1)");
  assert.equal(s.display("Z99"), String(serial(2024, 3, 1)));
  assert.equal(val("=DAY(DATE(2024, 2, 28) + 1)"), 29);
});
