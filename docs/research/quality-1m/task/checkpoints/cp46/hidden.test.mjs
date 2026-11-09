// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
const WHOLE = { type: "whole", min: 1, max: 10 };
function passes(rule, input) {
  const s = createSheet();
  s.setValidation("C3", rule);
  try {
    s.set("C3", input);
  } catch (e) {
    if (e.code === "#INVALID" && e.cell === "C3" && s.getInput("C3") === null) return false;
    throw e;
  }
  return s.getInput("C3") === (input === "" ? null : input);
}

test("cp46h whole numbers: the number grammar, whole values, bounds included", () => {
  for (const v of ["1", "10", "5", "5.0", "007", "10.000", "=100", "=A1", "=1/0", "", "=\"x\""]) assert.equal(passes(WHOLE, v), true, v);
  for (const v of ["0", "11", "-3", "5.5", "10.0001", " 5", "5 ", "1e1", "+5", "TRUE", "abc", "5%", ".5", "#REF!"]) assert.equal(passes(WHOLE, v), false, v);
  assert.equal(passes({ type: "whole", min: -5, max: -5 }, "-5"), true);
  assert.equal(passes({ type: "whole", min: -5, max: -5 }, "-4"), false);
  assert.equal(passes({ type: "whole", min: 0, max: 0 }, "-0"), true);
});

test("cp46h lists match exactly; formulas and clearing always pass", () => {
  const LIST = { type: "list", items: ["Yes", "No", "1"] };
  for (const v of ["Yes", "No", "1", "", "=1", "=\"Maybe\""]) assert.equal(passes(LIST, v), true, v);
  for (const v of ["yes", "YES", "No ", " No", "Maybe", "1.0", "01", "Yes,No"]) assert.equal(passes(LIST, v), false, v);
  const s = createSheet();
  s.set("A1", "Maybe");
  s.setValidation("A1", LIST);
  assert.deepEqual(s.invalidCells(), ["A1"]);
  assert.throws(() => s.set("A1", "Maybe"), thrown("#INVALID", "A1"));
  assert.throws(() => s.setCell("a1", "maybe"), thrown("#INVALID", "A1"));
  s.set("A1", "");
  assert.deepEqual(s.invalidCells(), []);
});

test("cp46h rules: checked shape, stored copy, errors in order", () => {
  const s = createSheet();
  s.setValidation("B2", { items: ["x"], type: "list", note: "dropped" });
  assert.deepEqual(s.getValidation("B2"), { type: "list", items: ["x"] });
  assert.deepEqual(Object.keys(s.getValidation("B2")), ["type", "items"]);
  s.setValidation("B3", { max: 4, extra: 1, min: 2, type: "whole" });
  assert.deepEqual(Object.keys(s.getValidation("B3")), ["type", "min", "max"]);
  const got = s.getValidation("B2");
  got.items.push("y");
  got.type = "whole";
  assert.deepEqual(s.getValidation("B2"), { type: "list", items: ["x"] });
  const items = ["p"];
  s.setValidation("B4", { type: "list", items });
  items.push("q");
  assert.deepEqual(s.getValidation("B4").items, ["p"]);
  const bad = [undefined, {}, [], "whole", 5, { type: "whole", min: 1 }, { type: "whole", min: 2, max: 1 }, { type: "whole", min: 1.5, max: 3 }, { type: "whole", min: "1", max: 3 }, { type: "whole", min: 1, max: Infinity }, { type: "list", items: [] }, { type: "list", items: ["a", ""] }, { type: "list", items: ["a", 1] }, { type: "list", items: "a" }, { type: "list", items: Array.from({ length: 51 }, (_, i) => `i${i}`) }, { type: "List", items: ["a"] }, { type: "date" }];
  for (const r of bad) assert.throws(() => s.setValidation("d1:d2", r), thrown("#RULE", "d1:d2"), JSON.stringify(r));
  assert.throws(() => s.setValidation("D0", 5), thrown("#ADDR", "D0"));
  assert.throws(() => s.setValidation(7, WHOLE), thrown("#ADDR", "7"));
  assert.throws(() => s.setValidation("A1:Z9999", 5), thrown("#ARG", "A1:Z9999"));
  assert.throws(() => s.getValidation("A"), thrown("#ADDR", "A"));
  assert.equal(s.getValidation("D1"), null);
  s.setValidation("E1", { type: "list", items: Array.from({ length: 50 }, (_, i) => `i${i}`) });
  assert.equal(s.getValidation("E1").items.length, 50);
  s.setValidation("B2:B4", null);
  assert.equal(s.getValidation("B3"), null);
});

test("cp46h setMany checks every address, then inputs in the order given", () => {
  const s = createSheet();
  s.setValidation("A1:B2", WHOLE);
  assert.throws(() => s.setMany({ C1: "x", B2: "99", A1: "0" }), thrown("#INVALID", "B2"));
  assert.throws(() => s.setMany({ B2: "99", ZZZ1: "1" }), thrown("#ADDR", "ZZZ1"));
  assert.throws(() => s.setMany({ a1: "5", b1: "five" }), thrown("#INVALID", "B1"));
  assert.deepEqual(s.cells(), []);
  s.setMany({ A1: "5", C9: "free", B2: "=99" });
  assert.deepEqual(s.cells(), ["A1", "B2", "C9"]);
});

test("cp46h fromCSV checks before writing, row-major, after its own checks", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.setValidation("A1:A3", WHOLE);
  s.setValidation("B1:B3", { type: "list", items: ["x", "y"] });
  assert.throws(() => s.fromCSV("2,z\n3,q\n99,x", "A1"), thrown("#INVALID", "B1"));
  assert.throws(() => s.fromCSV("2,x\n3,y\n99,x", "A1"), thrown("#INVALID", "A3"));
  assert.throws(() => s.fromCSV('2,"x\n', "A1"), thrown("#CSV", "1"));
  assert.throws(() => s.fromCSV("99", "A0"), (e) => e.code === "#ADDR");
  assert.deepEqual(s.cells(), ["A1"]);
  s.fromCSV("2,x\n,\n=50,", "A1");
  assert.equal(s.get("A1"), 2);
  assert.equal(s.get("A3"), 50);
  assert.deepEqual(s.invalidCells(), []);
});

test("cp46h copy, undo and structure are not checked; copy carries no rules", () => {
  const s = createSheet();
  s.set("C1", "99");
  s.set("C2", "maybe");
  s.setValidation("A1:A2", WHOLE);
  s.setValidation("C2", { type: "list", items: ["ok"] });
  s.copy("C1:C2", "A1");
  assert.equal(s.getInput("A1"), "99");
  assert.equal(s.getInput("A2"), "maybe");
  assert.deepEqual(s.getValidation("A1"), WHOLE);
  assert.equal(s.getValidation("A3"), null);
  assert.deepEqual(s.invalidCells(), ["A1", "A2", "C2"]);
  s.set("A1", "4");
  s.undo();
  assert.equal(s.getInput("A1"), "99");
  s.redo();
  s.undo();
  s.undo();
  assert.equal(s.getInput("A1"), null);
  s.redo();
  assert.equal(s.getInput("A1"), "99");
});

test("cp46h rules move with insert and delete; undo is one step per call", () => {
  const s = createSheet();
  s.setValidation("B2", WHOLE);
  s.setValidation("B2", { type: "whole", min: 1, max: 10 });
  s.setValidation("A1:A3", { type: "list", items: ["a"] });
  s.insertRows(2, 2);
  assert.deepEqual(s.getValidation("B4"), WHOLE);
  assert.equal(s.getValidation("B2"), null);
  assert.equal(s.getValidation("A2"), null);
  assert.deepEqual(s.getValidation("A5"), { type: "list", items: ["a"] });
  assert.throws(() => s.set("B4", "11"), thrown("#INVALID", "B4"));
  s.set("B2", "11");
  s.deleteCols("B", 1);
  assert.equal(s.getValidation("B4"), null);
  s.set("B4", "x");
  s.undo();
  s.undo();
  assert.deepEqual(s.getValidation("B4"), WHOLE);
  s.undo();
  s.undo();
  assert.deepEqual(s.getValidation("B2"), WHOLE);
  s.undo();
  assert.equal(s.getValidation("A1"), null);
  assert.deepEqual(s.getValidation("B2"), WHOLE);
  s.undo();
  assert.equal(s.getValidation("B2"), null);
  assert.equal(s.undo(), false);
});

test("cp46h rules are per sheet", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  m.setValidation("A1", WHOLE);
  d.set("A1", "99");
  assert.equal(d.getValidation("A1"), null);
  assert.throws(() => m.set("A1", "99"), thrown("#INVALID", "A1"));
  m.set("A1", "=Data!A1");
  assert.equal(m.get("A1"), 99);
  assert.deepEqual(m.invalidCells(), []);
  b.renameSheet("Data", "Facts");
  assert.equal(m.getInput("A1"), "=Facts!A1");
  assert.deepEqual(m.getValidation("A1"), WHOLE);
});

test("cp46h CHANGES.md has a cp46 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 46);
  assert.match(lines[45], /^- cp46: \S/);
  assert.notEqual(lines[45].slice(8).toLowerCase(), "data validation");
});
