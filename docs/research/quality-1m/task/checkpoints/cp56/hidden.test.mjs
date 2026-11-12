// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createWorkbook, loadWorkbook, loadSheet } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
const version = (b) => JSON.parse(b.save()).version;
function rich() {
  const b = createWorkbook({ errorOrder: "first" });
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  m.setMany({ A1: "1234.5", A2: "0.25", B1: "a", C3: "=SUBTOTAL(9, Data!A1:A3)" });
  m.setFormat("A1:A2", "#,##0");
  m.setFormat("A2", "0%");
  m.setValidation("B1", { type: "list", items: ["a", "b"] });
  m.setValidation("B3", { type: "whole", min: -1, max: 9 });
  m.setNote("A1", "big");
  d.fromCSV("10\n20\n30", "A1");
  d.merge("C2:D3");
  d.merge("B1:C1");
  d.hideRows(2);
  d.hideRows(10);
  d.hideCols("AA");
  d.hideCols("C");
  b.defineConstant("K", 2);
  return { b, m, d };
}
const RICH = '{"format":"workbook","version":3,"errorOrder":"first","sheets":[' +
  '{"name":"Main","cells":{"A1":"1234.5","B1":"a","A2":"0.25","C3":"=SUBTOTAL(9, Data!A1:A3)"},"names":{},"notes":{"A1":"big"},"formats":{"A1":"#,##0","A2":"0%"},"rules":{"B1":{"type":"list","items":["a","b"]},"B3":{"type":"whole","min":-1,"max":9}},"merges":[],"hiddenRows":[],"hiddenCols":[]},' +
  '{"name":"Data","cells":{"A1":"10","A2":"20","A3":"30"},"names":{},"notes":{},"formats":{},"rules":{},"merges":["B1:C1","C2:D3"],"hiddenRows":[2,10],"hiddenCols":["C","AA"]}],' +
  '"names":{"K":"=2"}}';

test("cp56h the version 3 text, every key in every sheet", () => {
  const { b } = rich();
  assert.equal(b.save(), RICH);
});

test("cp56h each version 3 layer alone makes version 3; notes and names do not", () => {
  const steps = [
    (s) => s.setFormat("A1", "0.00"),
    (s) => s.setValidation("A1", { type: "whole", min: 1, max: 2 }),
    (s) => s.merge("A1:A2"),
    (s) => s.hideRows(5),
    (s) => s.hideCols("E"),
  ];
  for (const [i, step] of steps.entries()) {
    const b = createWorkbook();
    b.addSheet("Main");
    const s = b.addSheet("Data");
    s.setNote("A1", "n");
    b.defineName("X", "Data!A1");
    assert.equal(version(b), 2, `before ${i}`);
    step(s);
    assert.equal(version(b), 3, `step ${i}`);
    assert.equal(s.undo(), true);
    assert.equal(b.save(), '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[{"name":"Main","cells":{},"names":{}},{"name":"Data","cells":{},"names":{},"notes":{"A1":"n"}}],"names":{"X":"Data!A1"}}', `undone ${i}`);
  }
  assert.equal(createWorkbook().save(), '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[]}');
});

test("cp56h clearing the last layer by its own method goes back to version 2", () => {
  const { b, m, d } = rich();
  m.setFormat("A1:A2", null);
  m.setValidation("B1:B3", null);
  d.unmerge("C3");
  d.unmerge("B1");
  d.showRows(1, 9999);
  assert.equal(version(b), 3);
  d.showCols("A", 702);
  assert.equal(b.save(), '{"format":"workbook","version":2,"errorOrder":"first","sheets":[{"name":"Main","cells":{"A1":"1234.5","B1":"a","A2":"0.25","C3":"=SUBTOTAL(9, Data!A1:A3)"},"names":{},"notes":{"A1":"big"}},{"name":"Data","cells":{"A1":"10","A2":"20","A3":"30"},"names":{}}],"names":{"K":"=2"}}');
});

test("cp56h sheet.save() is still version 1 without the layers", () => {
  const { m, d } = rich();
  assert.equal(m.save(), '{"format":"sheet","version":1,"cells":{"A1":"1234.5","B1":"a","A2":"0.25","C3":"=SUBTOTAL(9, Data!A1:A3)"},"names":{},"notes":{"A1":"big"}}');
  const t = loadSheet(d.save());
  assert.deepEqual(t.merges(), []);
  assert.deepEqual(t.hiddenRows(), []);
  assert.equal(loadSheet(m.save()).display("A1"), "1234.5");
});

test("cp56h a version 3 load brings every layer back, with empty undo lists", () => {
  const c = loadWorkbook(RICH);
  const m = c.sheet("main");
  const d = c.sheet("DATA");
  assert.equal(m.display("A1"), "1,234");
  assert.equal(m.display("A2"), "25%");
  assert.equal(m.getNote("A1"), "big");
  assert.throws(() => m.set("B1", "c"), thrown("#INVALID", "B1"));
  assert.throws(() => m.set("B3", "10"), thrown("#INVALID", "B3"));
  assert.deepEqual(m.getValidation("B3"), { type: "whole", min: -1, max: 9 });
  assert.deepEqual(d.merges(), ["B1:C1", "C2:D3"]);
  assert.equal(d.get("C1"), null);
  assert.throws(() => d.set("D3", "1"), thrown("#MERGE", "D3"));
  assert.deepEqual(d.hiddenRows(), [2, 10]);
  assert.deepEqual(d.hiddenCols(), ["C", "AA"]);
  assert.equal(m.get("C3"), 40);
  assert.equal(d.toCSV(), "10\n30");
  assert.deepEqual(c.names(), { K: "=2" });
  assert.equal(m.undo(), false);
  assert.equal(d.undo(), false);
  assert.equal(c.undo(), false);
  assert.equal(c.save(), RICH);
  d.showRows(2);
  assert.equal(m.get("C3"), 60);
  m.setFormat("A1", null);
  assert.equal(m.display("A1"), "1234.5");
  assert.equal(c.save().includes('"formats":{"A2":"0%"}'), true);
});

test("cp56h version 1 and version 2 texts load as before and save as version 2", () => {
  const v2 = '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[{"name":"Main","cells":{"A1":"5"},"names":{},"notes":{"A1":"x"},"formats":{"A1":"0.00"},"merges":["A1:B1"],"hiddenRows":[1]}],"names":{"K":"=1"}}';
  const c = loadWorkbook(v2);
  const m = c.sheet("Main");
  assert.equal(m.display("A1"), "5");
  assert.deepEqual(m.merges(), []);
  assert.deepEqual(m.hiddenRows(), []);
  assert.equal(c.save(), '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[{"name":"Main","cells":{"A1":"5"},"names":{},"notes":{"A1":"x"}}],"names":{"K":"=1"}}');
  const v1 = '{"format":"sheet","version":1,"cells":{"A1":"=Sheet_1!B1"},"names":{},"formats":{"A1":"0%"}}';
  const w = loadWorkbook(v1);
  assert.equal(w.save(), '{"format":"workbook","version":2,"errorOrder":"priority","sheets":[{"name":"Sheet_1","cells":{"A1":"=Sheet_1!B1"},"names":{}}]}');
  w.sheet("Sheet_1").hideCols("B");
  assert.equal(version(w), 3);
  assert.throws(() => loadWorkbook('{"format":"workbook","version":4,"errorOrder":"priority","sheets":[]}'), thrown("#LOAD", "version"));
  assert.throws(() => loadSheet(RICH), thrown("#LOAD", "format"));
});

test("cp56h version 3 load errors, with their cells", () => {
  const base = { name: "Main", cells: {}, names: {}, notes: {}, formats: {}, rules: {}, merges: [], hiddenRows: [], hiddenCols: [] };
  const text = (over, top = {}) => JSON.stringify({ format: "workbook", version: 3, errorOrder: "priority", sheets: [{ ...base, ...over }], names: {}, ...top });
  const cases = [
    [{ notes: undefined }, "sheets.0.notes"],
    [{ notes: [] }, "sheets.0.notes"],
    [{ formats: undefined }, "sheets.0.formats"],
    [{ formats: [] }, "sheets.0.formats"],
    [{ formats: { a1: "0.00" } }, "sheets.0.formats.a1"],
    [{ formats: { A1: "" } }, "sheets.0.formats.A1"],
    [{ formats: { A1: "0.0.0" } }, "sheets.0.formats.A1"],
    [{ formats: { A1: null } }, "sheets.0.formats.A1"],
    [{ rules: null }, "sheets.0.rules"],
    [{ rules: { A1: { type: "whole", max: 5, min: 1 } } }, "sheets.0.rules.A1"],
    [{ rules: { A1: { type: "whole", min: 1, max: 5, x: 1 } } }, "sheets.0.rules.A1"],
    [{ rules: { A1: { type: "list", items: [] } } }, "sheets.0.rules.A1"],
    [{ rules: { A1: null } }, "sheets.0.rules.A1"],
    [{ rules: { "1A": { type: "list", items: ["a"] } } }, "sheets.0.rules.1A"],
    [{ merges: {} }, "sheets.0.merges"],
    [{ merges: ["A1"] }, "sheets.0.merges.0"],
    [{ merges: ["a1:b2"] }, "sheets.0.merges.0"],
    [{ merges: ["B2:A1"] }, "sheets.0.merges.0"],
    [{ merges: ["A1:B2", "B2:C3"] }, "sheets.0.merges.1"],
    [{ merges: ["C1:D1", "A1:B1"] }, "sheets.0.merges.1"],
    [{ merges: ["A1:B1", 5] }, "sheets.0.merges.1"],
    [{ hiddenRows: "1" }, "sheets.0.hiddenRows"],
    [{ hiddenRows: [0] }, "sheets.0.hiddenRows.0"],
    [{ hiddenRows: [1, 10000] }, "sheets.0.hiddenRows.1"],
    [{ hiddenRows: [1.5] }, "sheets.0.hiddenRows.0"],
    [{ hiddenRows: ["3"] }, "sheets.0.hiddenRows.0"],
    [{ hiddenRows: [3, 2] }, "sheets.0.hiddenRows.1"],
    [{ hiddenRows: [2, 2] }, "sheets.0.hiddenRows.1"],
    [{ hiddenCols: null }, "sheets.0.hiddenCols"],
    [{ hiddenCols: ["a"] }, "sheets.0.hiddenCols.0"],
    [{ hiddenCols: ["AAA"] }, "sheets.0.hiddenCols.0"],
    [{ hiddenCols: ["B", "A"] }, "sheets.0.hiddenCols.1"],
    [{ hiddenCols: ["Z", "Z"] }, "sheets.0.hiddenCols.1"],
    [{ hiddenCols: [1] }, "sheets.0.hiddenCols.0"],
    [{ formats: [], rules: [] }, "sheets.0.formats"],
    [{ rules: [], hiddenCols: [1] }, "sheets.0.rules"],
    [{ cells: { a1: "1" }, formats: [] }, "sheets.0.cells.a1"],
    [{ notes: { A1: " x" }, formats: [] }, "sheets.0.notes.A1"],
  ];
  for (const [over, cell] of cases) assert.throws(() => loadWorkbook(text(over)), thrown("#LOAD", cell), JSON.stringify(over));
  assert.throws(() => loadWorkbook(text({}, { names: undefined })), thrown("#LOAD", "names"));
  assert.throws(() => loadWorkbook(text({ hiddenRows: [0] }, { names: [] })), thrown("#LOAD", "sheets.0.hiddenRows.0"));
  const two = JSON.stringify({ format: "workbook", version: 3, errorOrder: "priority", sheets: [{ ...base, merges: ["A1"] }, { ...base, name: "Data", cells: { a1: "1" } }], names: {} });
  assert.throws(() => loadWorkbook(two), thrown("#LOAD", "sheets.0.merges.0"));
  const ok = loadWorkbook(text({ merges: ["A1:B1", "A2:A3"], hiddenRows: [1, 9999], hiddenCols: ["Z", "AA", "ZZ"], rules: { A1: { type: "list", items: ["x"] } } }, { extra: 1 }));
  assert.deepEqual(ok.sheet("Main").merges(), ["A1:B1", "A2:A3"]);
  assert.deepEqual(ok.sheet("Main").hiddenCols(), ["Z", "AA", "ZZ"]);
});

test("cp56h layers moved by insert and delete are saved where they are now", () => {
  const b = createWorkbook();
  const s = b.addSheet("Main");
  s.set("B2", "3");
  s.setFormat("B2", "0.0");
  s.merge("C3:D4");
  s.hideRows(5);
  s.hideCols("E");
  s.insertRows(1);
  s.insertCols("A");
  const e = JSON.parse(b.save()).sheets[0];
  assert.deepEqual(e.cells, { C3: "3" });
  assert.deepEqual(e.formats, { C3: "0.0" });
  assert.deepEqual(e.merges, ["D4:E5"]);
  assert.deepEqual(e.hiddenRows, [6]);
  assert.deepEqual(e.hiddenCols, ["F"]);
  const c = loadWorkbook(b.save());
  assert.equal(c.sheet("Main").display("C3"), "3.0");
});

test("cp56h CHANGES.md has a cp56 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 56);
  assert.match(lines[55], /^- cp56: \S/);
  assert.notEqual(lines[55].slice(8).toLowerCase(), "save format version 3");
});

test("cp56h recall: formats and rules are written in the order cells() gives, row by row with Z before AA", () => {
  const b = createWorkbook();
  const s = b.addSheet("Main");
  for (const k of ["B2", "A10", "AA1", "A2", "Z1"]) {
    s.setFormat(k, "0.0");
    s.setValidation(k, { type: "whole", min: 1, max: 9 });
  }
  const saved = JSON.parse(b.save()).sheets[0];
  assert.deepEqual(Object.keys(saved.formats), ["Z1", "AA1", "A2", "B2", "A10"]);
  assert.deepEqual(Object.keys(saved.rules), ["Z1", "AA1", "A2", "B2", "A10"]);
});
