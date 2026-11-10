// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook, loadWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
function sheet(cells) {
  const s = createSheet();
  for (const [k, v] of Object.entries(cells)) s.set(k, v);
  return s;
}
const inputs = (s, keys) => keys.map((k) => s.getInput(k));

test("cp64h a copy moves references as copy does", () => {
  const s = sheet({ A1: "=B1+$B$1+B$1+$B1", C1: "=SUM(D1:E2)" });
  s.fillDown("A1:A3");
  assert.deepEqual(inputs(s, ["A2", "A3"]), ["=B2+$B$1+B$1+$B2", "=B3+$B$1+B$1+$B3"]);
  s.fillRight("C1:E1");
  assert.deepEqual(inputs(s, ["D1", "E1"]), ["=SUM(E1:F2)", "=SUM(F1:G2)"]);
  const t = sheet({ A9998: "=A9999", B9998: "=SUM(B9998:B9999)", ZY1: "=ZZ1+ZZ$2" });
  t.fillDown("A9998:B9999");
  assert.deepEqual(inputs(t, ["A9999", "B9999"]), ["=#REF!", "=SUM(#REF!)"]);
  t.fillRight("ZY1:ZZ1");
  assert.equal(t.getInput("ZZ1"), "=#REF!+#REF!");
  const u = sheet({ A1: "=a1 + sum(b1:B2)" });
  u.fillDown("A1:A2");
  assert.equal(u.getInput("A2"), "=A2 + sum(B2:B3)");
});

test("cp64h text and single numbers are copied, never counted up", () => {
  const s = sheet({ A1: "Item 1", B1: "5", C1: "Q1 2024", D1: "TRUE", E1: '="7"', F1: "007" });
  s.fillDown("A1:F3");
  assert.deepEqual(inputs(s, ["A2", "A3", "B3", "C3", "D3", "E3", "F3"]), ["Item 1", "Item 1", "5", "Q1 2024", "TRUE", '="7"', "007"]);
  const t = sheet({ A1: "1", A2: "x", B1: "1", B2: "=1+1", C1: "4", D1: "x", D2: "2", E1: "1", E2: "2 " });
  t.fillDown("A1:E3");
  assert.deepEqual(inputs(t, ["A2", "A3", "B2", "B3", "C2", "C3", "D2", "D3", "E2", "E3"]), ["1", "1", "1", "1", "4", "4", "x", "x", "1", "1"]);
});

test("cp64h two plain numbers start a series", () => {
  const s = sheet({ A1: "1", A2: "3", B1: "0.1", B2: "0.2", C1: "10", C2: "7.5", D1: "007", D2: "9", E1: "-1", E2: "-1" });
  s.fillDown("A1:E6");
  assert.deepEqual(inputs(s, ["A3", "A4", "A5", "A6"]), ["5", "7", "9", "11"]);
  assert.deepEqual(inputs(s, ["B3", "B4", "B5", "B6"]), ["0.3", "0.4", "0.5", "0.6"]);
  assert.deepEqual(inputs(s, ["C3", "C4", "C5", "C6"]), ["5", "2.5", "0", "-2.5"]);
  assert.deepEqual(inputs(s, ["D1", "D2", "D3", "D4"]), ["007", "9", "11", "13"]);
  assert.deepEqual(inputs(s, ["E3", "E6"]), ["-1", "-1"]);
  assert.equal(s.get("C5"), 0);
  const t = sheet({ A1: "0", A2: "0.3333333333333", B1: "100000000000000000000", B2: "200000000000000000000", C1: "1", C2: "1.00000000001" });
  t.fillDown("A1:C4");
  assert.deepEqual(inputs(t, ["A3", "A4"]), ["0.6666666667", "1"]);
  assert.deepEqual(inputs(t, ["B3", "B4"]), ["300000000000000000000", "400000000000000000000"]);
  assert.deepEqual(inputs(t, ["C3", "C4"]), ["1", "1"]);
  const u = sheet({ A1: "1", A2: "2" });
  u.fillDown("A1:A2");
  assert.equal(u.undo(), true);
  assert.equal(u.getInput("A2"), null);
});

test("cp64h fill right makes series and copies along rows", () => {
  const s = sheet({ A1: "2", B1: "4", A2: "=A1*2", A3: "x", B3: "y" });
  s.fillRight("A1:E3");
  assert.deepEqual(inputs(s, ["C1", "D1", "E1"]), ["6", "8", "10"]);
  assert.deepEqual(inputs(s, ["B2", "C2", "E2"]), ["=B1*2", "=C1*2", "=E1*2"]);
  assert.deepEqual(inputs(s, ["B3", "E3"]), ["x", "x"]);
  assert.equal(s.get("E2"), 20);
  const t = sheet({ A1: "1", A2: "2" });
  t.fillRight("A1:C2");
  assert.deepEqual(inputs(t, ["B1", "C1", "B2", "C2"]), ["1", "1", "2", "2"]);
  t.fillDown("a1:c3");
  assert.deepEqual(inputs(t, ["A3", "B3", "C3"]), ["3", "3", "3"]);
});

test("cp64h an empty first cell clears the line; one-cell lines change nothing", () => {
  const s = sheet({ A2: "x", A3: "=1", B1: "k" });
  s.fillDown("A1:B3");
  assert.deepEqual(inputs(s, ["A2", "A3", "B2", "B3"]), [null, null, "k", "k"]);
  assert.equal(s.undo(), true);
  assert.equal(s.getInput("A2"), "x");
  s.fillDown("A1:C1");
  s.fillRight("A2:A9");
  assert.equal(s.redo(), true);
  assert.deepEqual(s.cells(), ["B1", "B2", "B3"]);
});

test("cp64h formats follow the first cell; notes and rules stay", () => {
  const s = sheet({ A1: "1", A2: "2", B1: "0.5" });
  s.setFormat("A1", "0.00");
  s.setFormat("A2", "0%");
  s.setFormat("B3", "#,##0");
  s.setNote("B1", "top");
  s.setNote("B2", "kept");
  s.setValidation("A4", { type: "whole", min: 0, max: 100 });
  s.fillDown("A1:B4");
  assert.deepEqual([s.getFormat("A2"), s.getFormat("A3"), s.getFormat("A4")], ["0%", "0.00", "0.00"]);
  assert.deepEqual([s.getFormat("B2"), s.getFormat("B3")], [null, null]);
  assert.equal(s.display("A3"), "3.00");
  assert.equal(s.display("B4"), "0.5");
  assert.deepEqual(s.notes(), { B1: "top", B2: "kept" });
  assert.deepEqual(s.getValidation("A4"), { type: "whole", min: 0, max: 100 });
  assert.equal(s.getValidation("A2"), null);
  s.undo();
  assert.equal(s.getFormat("B3"), "#,##0");
  assert.equal(s.getInput("A3"), null);
  s.redo();
  assert.equal(s.getFormat("A4"), "0.00");
});

test("cp64h validation is checked in row-major order and a refusal writes nothing", () => {
  const s = sheet({ A1: "7", B1: "x", C1: "1", C2: "9" });
  s.setValidation("A3", { type: "whole", min: 1, max: 5 });
  s.setValidation("B2", { type: "list", items: ["y"] });
  assert.throws(() => s.fillDown("A1:B3"), thrown("#INVALID", "B2"));
  assert.throws(() => s.fillDown("A1:A3"), thrown("#INVALID", "A3"));
  assert.deepEqual(s.cells(), ["A1", "B1", "C1", "C2"]);
  assert.equal(s.undo(), true);
  assert.equal(s.getValidation("B2"), null);
  s.redo();
  s.set("A3", "4");
  s.setValidation("C3", { type: "whole", min: 1, max: 5 });
  assert.throws(() => s.fillDown("C1:C3"), thrown("#INVALID", "C3"));
  s.copy("A1", "A3");
  assert.equal(s.getInput("A3"), "7");
  assert.deepEqual(s.invalidCells(), ["A3"]);
  s.set("A1", "4");
  s.fillDown("A1:A3");
  assert.deepEqual(s.invalidCells(), []);
});

test("cp64h argument checks, in order, change nothing", () => {
  const s = sheet({ A1: "1", A2: "2" });
  s.merge("C3:D4");
  for (const bad of ["A0", "A1:B", "A1:B2:C3", null, 5, "", "$A$1:A2"]) {
    assert.throws(() => s.fillDown(bad), thrown("#ADDR", String(bad)), String(bad));
    assert.throws(() => s.fillRight(bad), thrown("#ADDR", String(bad)), String(bad));
  }
  assert.throws(() => s.fillDown("A1:Z9999"), thrown("#ARG", "A1:Z9999"));
  assert.throws(() => s.fillDown("a1:c3"), thrown("#MERGE", "a1:c3"));
  assert.throws(() => s.fillRight("D4:E9"), thrown("#MERGE", "D4:E9"));
  s.fillDown("A1:B3");
  assert.equal(s.getInput("A3"), "3");
  assert.equal(s.undo(), true);
  assert.equal(s.undo(), true);
  assert.equal(s.undo(), true);
  assert.equal(s.undo(), true);
  assert.equal(s.undo(), false);
});

test("cp64h hidden lines are filled and count in a series", () => {
  const s = sheet({ A1: "10", A2: "20", B1: "=A1" });
  s.hideRows(3);
  s.hideCols("C");
  s.fillDown("A1:B5");
  assert.deepEqual(inputs(s, ["A3", "A4", "A5", "B3", "B5"]), ["30", "40", "50", "=A3", "=A5"]);
  s.fillRight("A1:D1");
  assert.deepEqual(inputs(s, ["C1", "D1"]), ["10", "10"]);
  assert.deepEqual(s.hiddenRows(), [3]);
  s.set("E1", "=SUBTOTAL(9, A1:A5)");
  assert.equal(s.get("E1"), 120);
});

test("cp64h one undo step, on the workbook list too; dependents recalculate", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.fromCSV("1\n2\n3", "A1");
  m.set("A1", "=Data!A1*2");
  m.set("C1", "=SUM(A1:A3)");
  assert.equal(m.get("C1"), 2);
  m.fillDown("A1:A3");
  assert.deepEqual(inputs(m, ["A2", "A3"]), ["=Data!A2*2", "=Data!A3*2"]);
  assert.equal(m.get("C1"), 12);
  d.set("B1", "x");
  assert.equal(b.undo(), true);
  assert.equal(d.getInput("B1"), null);
  assert.equal(b.undo(), true);
  assert.equal(m.getInput("A2"), null);
  assert.equal(m.get("C1"), 2);
  assert.equal(b.redo(), true);
  assert.equal(m.get("C1"), 12);
  m.defineName("TOP", "A1");
  m.fillDown("A1:A2");
  assert.deepEqual(m.names(), { TOP: "A1" });
});

test("cp64h filled cells save and load with their formats", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  m.set("A1", "0.25");
  m.set("A2", "0.5");
  m.setFormat("A1", "0%");
  m.fillDown("A1:A4");
  const text = b.save();
  assert.equal(JSON.parse(text).version, 3);
  const c = loadWorkbook(text).sheet("Main");
  assert.deepEqual(inputs(c, ["A3", "A4"]), ["0.75", "1"]);
  assert.equal(c.display("A4"), "100%");
  assert.equal(c.display("A2"), "0.5");
});

test("cp64h CHANGES.md has a cp64 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 64);
  assert.match(lines[63], /^- cp64: \S/);
  assert.notEqual(lines[63].slice(8).toLowerCase(), "fill down and fill right");
});
