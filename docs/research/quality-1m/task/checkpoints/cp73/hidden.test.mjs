// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook, loadSheet } from "../../src/index.mjs";

const brief = (list) => list.map((f) => (f.kind === "unused-name" ? `name ${f.name}` : `${f.address} ${f.ref}`));

test("cp73h names first by name, then references by address, each pair once", () => {
  const s = createSheet();
  s.set("Z9", "1");
  s.defineName("zeta", "Z9");
  s.defineName("Alpha", "Z9");
  s.defineConstant("mid", 3);
  s.setMany({ C2: "=D4+B4+d4+$B$4+A9", A3: "=E1", B1: "=Q1*Q1", A1: "=Z9" });
  assert.deepEqual(brief(s.lint()), ["name ALPHA", "name MID", "name ZETA", "B1 Q1", "C2 B4", "C2 D4", "C2 A9", "A3 E1"]);
  const f = s.lint();
  assert.deepEqual(f[0], { kind: "unused-name", name: "ALPHA" });
  assert.deepEqual(f[3], { kind: "empty-ref", address: "B1", ref: "Q1" });
  f.length = 0;
  assert.equal(s.lint().length, 8);
});

test("cp73h cells inside ranges and behind names are never listed", () => {
  const s = createSheet();
  s.set("A1", "1");
  s.defineName("SPOT", "H8");
  s.defineName("BLOCK", "H1:H3");
  s.setMany({ B1: "=SUM(A1:A3)", B2: "=SPOT+1", B3: "=COUNT(BLOCK)", B4: "=SUM(G1:G2)+G3", B5: "=SUM(A1, A5)" });
  assert.deepEqual(brief(s.lint()), ["B4 G3", "B5 A5"]);
});

test("cp73h every reference in the text counts, read or not, and nothing is evaluated", () => {
  const s = createSheet();
  s.setMany({ A1: "=IF(TRUE, 1, B9)", A2: "=IFERROR(1, C9)", A3: '=CHOOSE(1, 5, D9)', A4: "=IF(FALSE, E9, 0)", A5: "=AND(TRUE, OR(FALSE, F9))" });
  assert.equal(s.get("A1"), 1);
  const before = s.stats().evaluations;
  assert.deepEqual(brief(s.lint()), ["A1 B9", "A2 C9", "A3 D9", "A4 E9", "A5 F9"]);
  assert.equal(s.stats().evaluations, before);
  s.set("A6", "=B9*2");
  s.lint();
  s.lint();
  assert.equal(s.stats().evaluations, before);
  assert.equal(s.undo(), true);
  assert.equal(s.getInput("A6"), null);
  assert.equal(s.undo(), true);
  assert.deepEqual(s.cells(), []);
  assert.deepEqual(s.lint(), []);
});

test("cp73h a name hidden by LET is not used; a LET value that names it is", () => {
  const s = createSheet();
  s.set("A1", "4");
  s.defineConstant("rate", 2);
  s.defineName("base", "A1");
  s.defineName("tax", "A1");
  s.set("B1", "=LET(rate, 2, rate * A1)");
  s.set("B2", "=LET(x, BASE, x + 1)");
  s.set("B3", "=LET(tax, tax + 1, tax)");
  assert.deepEqual(brief(s.lint()), ["name RATE"]);
  s.set("B4", "=LET(y, 1, y) + Rate");
  assert.deepEqual(brief(s.lint()), []);
  s.set("B4", "");
  s.set("B3", "=LET(tax, 1, tax)");
  assert.deepEqual(brief(s.lint()), ["name RATE", "name TAX"]);
});

test("cp73h strings, unparseable formulas and errors", () => {
  const s = createSheet();
  s.defineConstant("K", 1);
  s.defineName("SPAN", "A1:A2");
  s.defineName("LOST", "A1");
  s.setMany({ B1: '="K"&"LOST"', B2: "=SPAN", B3: "=LOST+ C7 +", B4: '="C8"' });
  assert.equal(s.get("B2").code, "#VALUE!");
  assert.equal(s.get("B3").code, "#PARSE!");
  assert.deepEqual(brief(s.lint()), ["name K", "name LOST"]);
  s.set("B5", "=k/0");
  assert.deepEqual(brief(s.lint()), ["name LOST"]);
  s.removeName("LOST");
  s.set("B6", "=LOST");
  assert.deepEqual(brief(s.lint()), []);
});

test("cp73h what counts as empty: no input or a covered cell; formulas and hidden lines do not matter", () => {
  const s = createSheet();
  s.setMany({ A1: "x", B1: "kept", C1: '=""', D1: "0", A3: "=A1&B1&C1&D1&E1", A4: "=A2+B2" });
  s.merge("A1:B2");
  assert.equal(s.getInput("B1"), "kept");
  s.hideRows(2);
  s.hideCols("E");
  assert.deepEqual(brief(s.lint()), ["A3 B1", "A3 E1", "A4 A2", "A4 B2"]);
  s.unmerge("A1");
  assert.deepEqual(brief(s.lint()), ["A3 E1", "A4 A2", "A4 B2"]);
  s.set("E1", "=1/0");
  assert.deepEqual(brief(s.lint()), ["A4 A2", "A4 B2"]);
  s.set("A2", "=A2");
  assert.deepEqual(brief(s.lint()), ["A4 B2"]);
});

test("cp73h other sheets: labelled with the workbook's name, in sheet order, missing sheets skipped", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  b.addSheet("Zed");
  const d = b.addSheet("Data");
  m.set("A1", "=data!b1+zed!c3+Main!D4+Gone!A1+D4+ZED!A2+Zed!$C$3");
  assert.deepEqual(brief(m.lint()), ["A1 D4", "A1 Zed!A2", "A1 Zed!C3", "A1 Data!B1"]);
  d.set("B1", "1");
  b.renameSheet("Zed", "Alt");
  assert.equal(m.getInput("A1"), "=data!b1+Alt!c3+Main!D4+Gone!A1+D4+Alt!A2+Alt!$C$3");
  assert.deepEqual(brief(m.lint()), ["A1 D4", "A1 Alt!A2", "A1 Alt!C3"]);
  b.addSheet("Gone");
  assert.deepEqual(brief(m.lint()), ["A1 D4", "A1 Alt!A2", "A1 Alt!C3", "A1 Gone!A1"]);
  b.deleteSheet("Alt");
  assert.equal(m.getInput("A1"), "=data!b1+#REF!+Main!D4+Gone!A1+D4+#REF!+#REF!");
  assert.deepEqual(brief(m.lint()), ["A1 D4", "A1 Gone!A1"]);
  b.removeSheet("Main");
  assert.deepEqual(brief(m.lint()), ["A1 D4"]);
});

test("cp73h a lone sheet never lists a reference to another sheet", () => {
  const s = createSheet();
  s.set("A1", "=Data!A1+B1");
  assert.deepEqual(brief(s.lint()), ["A1 B1"]);
});

test("cp73h workbook names are never listed, and only own names are checked", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  b.defineName("SHARED", "Data!A1");
  b.defineConstant("UNUSED", 1);
  m.defineName("OWN", "B1");
  d.defineName("SHARED", "B1");
  m.set("A1", "=SHARED+OWN");
  assert.deepEqual(brief(m.lint()), []);
  assert.deepEqual(brief(d.lint()), ["name SHARED"]);
  d.set("A2", "=SHARED");
  assert.deepEqual(brief(d.lint()), []);
  m.set("A1", "=SHARED");
  assert.deepEqual(brief(m.lint()), ["name OWN"]);
});

test("cp73h insert, delete and undo: lint reads the text as it is now", () => {
  const s = createSheet();
  s.setMany({ A1: "=B1+B2", B2: "5" });
  assert.deepEqual(brief(s.lint()), ["A1 B1"]);
  s.insertRows(2);
  assert.equal(s.getInput("A1"), "=B1+B3");
  assert.deepEqual(brief(s.lint()), ["A1 B1"]);
  s.insertCols("A");
  assert.deepEqual(brief(s.lint()), ["B1 C1"]);
  s.deleteRows(1);
  assert.deepEqual(brief(s.lint()), []);
  s.undo();
  assert.deepEqual(brief(s.lint()), ["B1 C1"]);
  s.set("C1", "1");
  s.deleteCols("C");
  assert.equal(s.getInput("B1"), "=#REF!+#REF!");
  assert.deepEqual(brief(s.lint()), []);
});

test("cp73h copy, fill and a loaded sheet", () => {
  const s = createSheet();
  s.setMany({ A1: "1", B1: "=A1" });
  s.copy("B1", "B3");
  s.fillRight("B1:D1");
  assert.deepEqual(s.cells(), ["A1", "B1", "C1", "D1", "B3"]);
  assert.deepEqual(brief(s.lint()), ["B3 A3"]);
  s.defineName("n", "A1");
  const t = loadSheet(s.save());
  assert.deepEqual(brief(t.lint()), ["name N", "B3 A3"]);
});

test("cp73h CHANGES.md has a cp73 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 73);
  assert.match(lines[72], /^- cp73: \S/);
  assert.notEqual(lines[72].slice(8).toLowerCase(), "lint");
});
