// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook, loadWorkbook } from "../../src/index.mjs";

const err = (v) => (v && typeof v === "object" ? `${v.code}@${v.cell}` : v);
function val(f, setup = {}, opts) {
  const s = createSheet(opts);
  for (const [k, v] of Object.entries(setup)) s.set(k, v);
  s.set("F6", f);
  return err(s.get("F6"));
}

test("cp60h CHOOSE reads its index as a truncated number", () => {
  assert.equal(val('=CHOOSE(2.9, "a", "b", "c")'), "b");
  assert.equal(val('=CHOOSE(TRUE, "a", "b")'), "a");
  assert.equal(val('=CHOOSE(3.0001, "a", "b", "c")'), "c");
  assert.equal(val('=CHOOSE(A1, "a", "b")', { A1: "2" }), "b");
  for (const f of ['=CHOOSE(0, "a")', '=CHOOSE(0.9, "a")', '=CHOOSE(-1, "a")', '=CHOOSE(3, "a", "b")', '=CHOOSE(A1, "a")', '=CHOOSE("1", "a")', '=CHOOSE(FALSE, "a")', "=CHOOSE(1)", "=CHOOSE()", '=CHOOSE(A1:A2, "a")']) {
    assert.equal(val(f), "#VALUE!@F6", f);
  }
  assert.equal(val('=CHOOSE(nope, "a")'), "#NAME?@F6");
  assert.equal(val('=CHOOSE(A1, "a")', { A1: "=1/0" }), "#DIV/0!@A1");
});

test("cp60h CHOOSE evaluates only the chosen value", () => {
  assert.equal(val("=CHOOSE(1, 5, 1/0)"), 5);
  assert.equal(val("=CHOOSE(2, 1/0, 5)"), 5);
  assert.equal(val('=CHOOSE(3, nope, 1/0, "ok")'), "ok");
  assert.equal(val("=CHOOSE(2, 5, 1/0)"), "#DIV/0!@F6");
  assert.equal(val("=CHOOSE(1, A1:A2, 7)"), "#VALUE!@F6");
  assert.equal(val("=CHOOSE(2, A1:A2, 7)"), 7);
  const s = createSheet();
  s.set("B1", "=1+1");
  s.set("B2", "=CHOOSE(1, 5, B1)");
  const before = s.stats().evaluations;
  assert.equal(s.get("B2"), 5);
  assert.equal(s.stats().evaluations, before + 1);
  s.set("B3", "=CHOOSE(2, 5, B1)");
  assert.equal(s.get("B3"), 2);
  assert.equal(s.stats().evaluations, before + 3);
});

test("cp60h CHOOSE never gives a range", () => {
  const setup = { A1: "1", A2: "2", A3: "3", B1: "10" };
  assert.equal(val("=SUM(CHOOSE(1, A1:A3))", setup), "#VALUE!@F6");
  assert.equal(val("=CHOOSE(1, A1:A3)", setup), "#VALUE!@F6");
  assert.equal(val("=COUNTIF(CHOOSE(1, A1:A3), 1)", setup), "#VALUE!@F6");
  assert.equal(val("=SUMPRODUCT(CHOOSE(1, A1:A3))", setup), "#VALUE!@F6");
  assert.equal(val("=SUM(CHOOSE(2, A1:A3, B1))", setup), 10);
  assert.equal(val("=CHOOSE(1, C1)", setup), 0);
  assert.equal(val('=CHOOSE(1, C1)&"x"', setup), "x");
  assert.equal(val("=CHOOSE(2, A1, A2) + CHOOSE(3, A1, A2, A3)", setup), 5);
});

test("cp60h every reference is a precedent, whichever value is picked", () => {
  const s = createSheet();
  s.set("A1", "=CHOOSE(1, 5, A1)");
  assert.equal(err(s.get("A1")), "#CYCLE!@A1");
  s.set("B1", '=SWITCH(1, 1, "a", B2, C1:C2)');
  assert.deepEqual(s.precedents("B1"), ["C1", "B2", "C2"]);
  s.set("B2", "=B1");
  assert.equal(err(s.get("B1")), "#CYCLE!@B1");
  assert.equal(err(s.get("B2")), "#CYCLE!@B2");
});

test("cp60h SWITCH compares type-strictly and with case", () => {
  assert.equal(val('=SWITCH("a", "A", 1, 2)'), 2);
  assert.equal(val('=SWITCH("a", "A", 1)'), "#N/A@F6");
  assert.equal(val('=SWITCH("Ab", "ab", 1, "AB", 2, "Ab", 3)'), 3);
  assert.equal(val('=SWITCH("5", 5, "n", "t")'), "t");
  assert.equal(val('=SWITCH(5, "5", 1, 5, 2)'), 2);
  assert.equal(val('=SWITCH(1, TRUE, "b", 1, "n")'), "n");
  assert.equal(val('=SWITCH(TRUE, 1, "one", TRUE, "true")'), "true");
  assert.equal(val('=SWITCH(1=1, "TRUE", 1, FALSE, 2, TRUE, 3)'), 3);
  assert.equal(val('=SWITCH(0.1+0.2, 0.3, "yes", "no")'), "yes");
  assert.equal(val('=SWITCH(1, 1+10^-12, "near", "far")'), "near");
  assert.equal(val('=IF("a" = "A", SWITCH("a", "A", "same", "differ"))'), "differ");
});

test("cp60h an empty cell counts as the number 0", () => {
  assert.equal(val('=SWITCH(A1, "", "blank", 0, "zero")'), "zero");
  assert.equal(val('=SWITCH(A1, FALSE, "f", 0, "z")'), "z");
  assert.equal(val('=SWITCH(A1, "", "blank")'), "#N/A@F6");
  assert.equal(val('=SWITCH(0, A1, "matched")'), "matched");
  assert.equal(val('=SWITCH(A1, B1, "both empty")'), "both empty");
  assert.equal(val('=SWITCH(A1, B1, "x")', { A1: '=""' }), "#N/A@F6");
  assert.equal(val('=SWITCH("", B1, "x", "", "text")'), "text");
});

test("cp60h SWITCH evaluates cases in order and only the result it picks", () => {
  assert.equal(val('=SWITCH(1, 1, "a", 1/0, "b")'), "a");
  assert.equal(val('=SWITCH(2, 1, 1/0, 2, "b")'), "b");
  assert.equal(val('=SWITCH(2, 1/0, "a", 2, "b")'), "#DIV/0!@F6");
  assert.equal(val('=SWITCH(1, 1, "a", 1/0)'), "a");
  assert.equal(val("=SWITCH(9, 1, 2, 1/0)"), "#DIV/0!@F6");
  assert.equal(val('=SWITCH(nope, 1/0, "a")'), "#NAME?@F6");
  assert.equal(val('=SWITCH(1/0, nope, "a")'), "#DIV/0!@F6");
  assert.equal(val('=SWITCH(2, 1, "a", nope, "b", 2, "c")'), "#NAME?@F6");
  assert.equal(val('=SWITCH(1, A1:A2, "a", "b")'), "#VALUE!@F6");
  assert.equal(val('=SWITCH(A1:A2, 1, "a", "b")'), "#VALUE!@F6");
  assert.equal(val('=SWITCH(1, 1, A1:A2, "b")'), "#VALUE!@F6");
  assert.equal(val('=SWITCH(1, 2, A1:A2, "b")'), "b");
});

test("cp60h pairs, the default, and #N/A in the priority order", () => {
  assert.equal(val('=SWITCH(9, 1, "a", 2, "b")'), "#N/A@F6");
  assert.equal(val('=SWITCH(9, 1, "a", 2, "b", "d")'), "d");
  assert.equal(val('=SWITCH(2, 1, "a", 2, "b", "d")'), "b");
  assert.equal(val('=SWITCH("d", 1, "a", "d")'), "d");
  assert.equal(val("=SWITCH(1, 2)"), "#VALUE!@F6");
  assert.equal(val("=SWITCH(1)"), "#VALUE!@F6");
  assert.equal(val("=SWITCH()"), "#VALUE!@F6");
  assert.equal(val("=SWITCH(9, 1, 2) + 1/0"), "#N/A@F6");
  assert.equal(val("=SWITCH(9, 1, 2) & nope"), "#NAME?@F6");
  assert.equal(val("=SWITCH(9, 1, 2) + 1/0", {}, { errorOrder: "first" }), "#N/A@F6");
  assert.equal(val("=1/0 + SWITCH(9, 1, 2)", {}, { errorOrder: "first" }), "#DIV/0!@F6");
  assert.equal(val('=IFERROR(SWITCH(9, 1, 2), "none")'), "none");
  assert.equal(val("=ISERROR(SWITCH(9, 1, 2))"), true);
});

test("cp60h names, constants, other sheets, insert, copy and rename", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.fromCSV("red\nGreen\nblue", "A1");
  m.defineConstant("PICK", 2);
  m.defineName("COLOURS", "B1:B3");
  m.set("A1", "=CHOOSE(PICK, Data!A1, Data!A2, Data!A3)");
  m.set("A2", '=SWITCH(A1, "green", 1, "Green", 2, 0)');
  m.set("A3", "=CHOOSE(1, COLOURS)");
  assert.equal(m.get("A1"), "Green");
  assert.equal(m.get("A2"), 2);
  assert.equal(err(m.get("A3")), "#VALUE!@A3");
  m.defineConstant("PICK", 3);
  assert.equal(m.get("A1"), "blue");
  assert.equal(m.get("A2"), 0);
  b.renameSheet("Data", "Colours");
  assert.equal(m.getInput("A1"), "=CHOOSE(PICK, Colours!A1, Colours!A2, Colours!A3)");
  m.insertRows(1);
  assert.equal(m.getInput("A3"), '=SWITCH(A2, "green", 1, "Green", 2, 0)');
  m.copy("A3", "B4");
  assert.equal(m.getInput("B4"), '=SWITCH(B3, "green", 1, "Green", 2, 0)');
  assert.equal(m.get("B4"), 0);
  assert.equal(m.canonical("A3"), '=SWITCH(A2,"green",1,"Green",2,0)');
  const c = loadWorkbook(b.save());
  assert.equal(c.sheet("Main").get("A3"), 0);
  assert.equal(c.sheet("Main").get("A2"), "blue");
});

test("cp60h CHANGES.md has a cp60 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 60);
  assert.match(lines[59], /^- cp60: \S/);
  assert.notEqual(lines[59].slice(8).toLowerCase(), "choose and switch");
});
