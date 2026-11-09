// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createWorkbook, loadWorkbook } from "../../src/index.mjs";

function book() {
  const b = createWorkbook();
  return { b, m: b.addSheet("Main"), d: b.addSheet("Data"), x: b.addSheet("Extra") };
}

test("cp55h steps come back in the order they were made, across sheets", () => {
  const { b, m, d, x } = book();
  m.set("A1", "1");
  d.set("A1", "2");
  m.set("A2", "3");
  x.set("A1", "4");
  d.set("A2", "5");
  const st = () => [m.getInput("A1"), d.getInput("A1"), m.getInput("A2"), x.getInput("A1"), d.getInput("A2")].map((v) => v ?? "-").join("");
  assert.equal(st(), "12345");
  const seen = [];
  while (b.undo()) seen.push(st());
  assert.deepEqual(seen, ["1234-", "123--", "12---", "1----", "-----"]);
  assert.equal(b.undo(), false);
  const back = [];
  while (b.redo()) back.push(st());
  assert.deepEqual(back, ["1----", "12---", "123--", "1234-", "12345"]);
  assert.equal(b.redo(), false);
});

test("cp55h sheet undo and redo mix with the book's; a redo counts as new", () => {
  const { b, m, d } = book();
  m.set("A1", "1");
  d.set("A1", "2");
  b.defineConstant("K", 3);
  m.set("A2", "4");
  const st = () => [m.getInput("A1"), d.getInput("A1"), b.names().K, m.getInput("A2")].map((v) => v ?? "-").join(",");
  assert.equal(b.undo(), true);
  assert.equal(b.undo(), true);
  assert.equal(b.undo(), true);
  assert.equal(st(), "1,-,-,-");
  assert.equal(b.redo(), true);
  assert.equal(st(), "1,2,-,-");
  assert.equal(m.undo(), true);
  assert.equal(st(), "-,2,-,-");
  assert.equal(b.redo(), true);
  assert.equal(st(), "1,2,-,-");
  assert.equal(b.undo(), true);
  assert.equal(st(), "-,2,-,-");
  assert.equal(d.redo(), false);
  assert.equal(m.redo(), true);
  assert.equal(b.redo(), true);
  assert.equal(st(), "1,2,=3,-");
  assert.equal(b.redo(), true);
  assert.equal(st(), "1,2,=3,4");
  assert.equal(b.redo(), false);
});

test("cp55h a change clears only its own list's redo", () => {
  const { b, m, d } = book();
  d.set("A1", "1");
  m.set("A1", "2");
  b.undo();
  b.undo();
  m.set("B1", "new");
  assert.equal(m.getInput("A1"), null);
  assert.equal(b.redo(), true);
  assert.equal(d.getInput("A1"), "1");
  assert.equal(m.getInput("A1"), null);
  assert.equal(b.redo(), false);
  b.defineConstant("K", 1);
  b.undo();
  b.undo();
  assert.equal(d.getInput("A1"), null);
  assert.equal(m.getInput("B1"), "new");
  b.defineConstant("J", 2);
  assert.equal(b.redo(), true);
  assert.equal(d.getInput("A1"), "1");
  assert.equal(b.redo(), false);
  assert.deepEqual(b.names(), { J: "=2" });
});

test("cp55h workbook names: one step each, only through the book, values follow", () => {
  const { b, m, d, x } = book();
  x.set("A1", "x");
  d.fromCSV("1\n2", "A1");
  m.set("A1", "=SUM(ALL)*K");
  b.defineName("ALL", "Data!A1:A2");
  b.defineConstant("K", 2);
  b.defineConstant("K", 2);
  b.defineConstant("K", 10);
  b.removeName("ALL");
  assert.equal(b.removeName("ALL"), false);
  assert.equal(m.get("A1").code, "#NAME?");
  assert.equal(x.undo(), true);
  assert.deepEqual(b.names(), { K: "=10" });
  assert.equal(x.undo(), false);
  assert.equal(b.undo(), true);
  assert.equal(m.get("A1"), 30);
  assert.equal(b.undo(), true);
  assert.equal(m.get("A1"), 6);
  assert.equal(b.undo(), true);
  assert.deepEqual(b.names(), { ALL: "Data!A1:A2" });
  assert.equal(m.get("A1").code, "#NAME?");
  assert.equal(b.undo(), true);
  assert.deepEqual(b.names(), {});
  assert.equal(b.undo(), true);
  assert.equal(m.getInput("A1"), null);
  assert.equal(b.redo(), true);
  assert.equal(b.redo(), true);
  assert.equal(b.redo(), true);
  assert.equal(m.get("A1"), 6);
});

test("cp55h the workbook names list holds 100 steps", () => {
  const { b } = book();
  for (let i = 1; i <= 105; i++) b.defineConstant("K", i);
  let n = 0;
  while (b.undo()) n++;
  assert.equal(n, 100);
  assert.deepEqual(b.names(), { K: "=5" });
});

test("cp55h grouped steps are one step through the book too", () => {
  const { b, m, d } = book();
  m.setMany({ A1: "3", A2: "1", A3: "2" });
  d.set("A1", "=Main!A1");
  m.sort("A1:A3", "A");
  m.copy("A1:A3", "B1");
  m.insertRows(1);
  assert.equal(d.get("A1"), 0);
  b.undo();
  assert.equal(d.get("A1"), 1);
  b.undo();
  assert.equal(m.getInput("B1"), null);
  b.undo();
  assert.equal(m.getInput("A1"), "3");
  assert.equal(d.get("A1"), 3);
  b.undo();
  assert.equal(d.getInput("A1"), null);
  b.undo();
  assert.deepEqual(m.cells(), []);
  assert.equal(b.undo(), false);
});

test("cp55h a removed sheet takes its steps with it", () => {
  const { b, m, d } = book();
  d.set("A1", "1");
  m.set("A1", "2");
  d.set("A2", "3");
  b.removeSheet("Data");
  assert.equal(b.undo(), true);
  assert.equal(m.getInput("A1"), null);
  assert.equal(b.undo(), false);
  assert.equal(d.getInput("A2"), "3");
  const n = b.addSheet("Data");
  assert.equal(b.undo(), false);
  assert.equal(d.undo(), true);
  assert.equal(d.getInput("A2"), null);
  n.set("A1", "x");
  assert.equal(b.redo(), true);
  assert.equal(m.getInput("A1"), "2");
  assert.equal(b.undo(), true);
  assert.equal(m.getInput("A1"), null);
  assert.equal(b.undo(), true);
  assert.equal(n.getInput("A1"), null);
  assert.equal(d.getInput("A1"), "1");
});

test("cp55h renameSheet and deleteSheet clear the workbook names list too", () => {
  const { b, m } = book();
  b.defineConstant("K", 1);
  m.set("A1", "1");
  b.renameSheet("Main", "Main");
  assert.equal(b.undo(), true);
  assert.equal(b.undo(), true);
  assert.equal(b.redo(), true);
  b.renameSheet("Extra", "Other");
  assert.equal(b.undo(), false);
  assert.equal(b.redo(), false);
  assert.deepEqual(b.names(), { K: "=1" });
  b.defineConstant("J", 2);
  m.set("A2", "2");
  b.deleteSheet("Other");
  assert.equal(b.undo(), false);
  assert.deepEqual(b.names(), { J: "=2", K: "=1" });
  assert.equal(createWorkbook().undo(), false);
  assert.equal(createWorkbook().redo(), false);
});

test("cp55h a loaded workbook has nothing to undo", () => {
  const { b, m } = book();
  m.set("A1", "1");
  b.defineConstant("K", 1);
  const c = loadWorkbook(b.save());
  assert.equal(c.undo(), false);
  c.sheet("Data").set("A1", "5");
  c.defineConstant("K", 2);
  assert.equal(c.undo(), true);
  assert.deepEqual(c.names(), { K: "=1" });
  assert.equal(c.undo(), true);
  assert.equal(c.undo(), false);
  assert.equal(b.undo(), true);
  assert.deepEqual(b.names(), {});
});

test("cp55h CHANGES.md has a cp55 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 55);
  assert.match(lines[54], /^- cp55: \S/);
  assert.notEqual(lines[54].slice(8).toLowerCase(), "undo across a workbook");
});
