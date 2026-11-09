// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The checkpoint titles as starter/FEATURES.md lists them.
const TITLES = [
  "cell store", "arithmetic formulas", "cell references", "error propagation and priority", "display text",
  "comparison, booleans, concatenation", "literals inside formulas", "number tolerance and the evaluation counter",
  "cycles", "precedents and dependents", "incremental recalculation", "recalculation order log",
  "function syntax and SUM over ranges", "named ranges", "AVERAGE, MIN, MAX, COUNT", "ROUND, ROUNDUP, ROUNDDOWN",
  "IF, AND, OR, NOT", "text functions", "dates", "ISERROR and IFERROR", "VLOOKUP", "SUMIF", "insert rows",
  "delete rows", "insert and delete columns", "absolute references and copy", "undo and redo", "CSV export",
  "CSV import", "save and load", "workbooks and sheet references", "cross-sheet cycles and recalculation", "API v2",
  "optional reading-order errors", "save format v2 and migration", "performance budget", "sheet rename",
  "canonical formula text", "explain", "change log",
];

const entries = () =>
  readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "" && !l.startsWith("#"));

test("cp40h every non-blank, non-heading line is an entry, cp01 to cp40 in order", () => {
  const lines = entries();
  assert.equal(lines.length, 40);
  lines.forEach((line, i) => {
    const nn = String(i + 1).padStart(2, "0");
    assert.ok(line.startsWith(`- cp${nn}: `), `line ${i + 1}: ${line}`);
  });
});

test("cp40h texts: length, spacing, not the bare title, all different", () => {
  const texts = entries().map((l) => l.replace(/^- cp\d\d: /, ""));
  const seen = new Set();
  texts.forEach((t, i) => {
    assert.ok(t.length >= 1 && t.length <= 120, `cp${i + 1} length ${t.length}`);
    assert.equal(t, t.trim(), `cp${i + 1} spacing`);
    assert.notEqual(t.toLowerCase(), TITLES[i].toLowerCase(), `cp${i + 1} is only its title`);
    assert.ok(!seen.has(t.toLowerCase()), `cp${i + 1} repeats an earlier text`);
    seen.add(t.toLowerCase());
  });
});
