// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet, loadSheet, createWorkbook } from "../../src/index.mjs";

const thrown = (code, cell) => (e) => e && e.code === code && e.cell === cell && typeof e.message === "string" && e.message.length > 0;
const err = (v) => (v && typeof v === "object" ? `${v.code}@${v.cell}` : v);
function fill(s) {
  s.set("A1", "=1/0");
  s.set("B1", "=nope");
  s.set("C1", "=A1+B1");
  s.set("C2", "=B1+A1");
  s.set("C3", "=SUM(B1,A1)");
  s.set("C4", "=SUM(A1:B1)");
  s.set("C5", "=A1&B1");
  s.set("C6", "=IF(B1,A1,1)");
  s.set("C7", "=-A1*B1");
  s.set("C8", "=MAX(A1,B1)");
  s.set("A2", "=1/0");
  s.set("C9", "=A2+A1");
  s.set("D1", "=COUNTIF(A1:A2,1)+SUMIF(B1:B2,1)");
  return s;
}
const keys = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"];

test("cp34h priority order is unchanged and the default", () => {
  for (const s of [fill(createSheet()), fill(createSheet({})), fill(createSheet({ errorOrder: "priority" }))]) {
    assert.deepEqual(keys.map((k) => err(s.get(k))), ["#NAME?@B1", "#NAME?@B1", "#NAME?@B1", "#NAME?@B1", "#NAME?@B1", "#NAME?@B1", "#NAME?@B1", "#NAME?@B1", "#DIV/0!@A1"]);
  }
});

test("cp34h first order: operators, arguments, ranges", () => {
  const s = fill(createSheet({ errorOrder: "first" }));
  assert.deepEqual(keys.map((k) => err(s.get(k))), ["#DIV/0!@A1", "#NAME?@B1", "#NAME?@B1", "#DIV/0!@A1", "#DIV/0!@A1", "#NAME?@B1", "#DIV/0!@A1", "#DIV/0!@A1", "#DIV/0!@A2"]);
  s.set("E1", "=SUM(B1:B2,A1)");
  s.set("E2", "=SUM(A2:B2)");
  s.set("B2", "=1/0");
  assert.equal(err(s.get("E1")), "#NAME?@B1");
  assert.equal(err(s.get("E2")), "#DIV/0!@A2");
  s.set("F1", "=SUM(A1:B2)");
  assert.equal(err(s.get("F1")), "#DIV/0!@A1");
  s.set("A1", "1");
  assert.equal(err(s.get("F1")), "#NAME?@B1");
  assert.equal(err(s.get("C1")), "#NAME?@B1");
  s.set("G1", "=IFERROR(B1,7)+A2");
  assert.equal(err(s.get("G1")), "#DIV/0!@A2");
});

test("cp34h first order keeps cycles and single errors as they were", () => {
  const s = createSheet({ errorOrder: "first" });
  s.set("A1", "=A2");
  s.set("A2", "=A1");
  s.set("B1", "=1/0+A1");
  s.set("B2", "=A1+1/0");
  s.set("B3", "=nope");
  s.set("B4", "=B3*2");
  assert.equal(err(s.get("A1")), "#CYCLE!@A1");
  assert.equal(err(s.get("B1")), "#DIV/0!@B1");
  assert.equal(err(s.get("B2")), "#CYCLE!@A1");
  assert.equal(err(s.get("B4")), "#NAME?@B3");
});

test("cp34h options are checked first", () => {
  for (const [opts, cell] of [[{ errorOrder: "excel" }, "excel"], [{ errorOrder: 1 }, "1"], [{ errorOrder: null }, "null"], [{ errorOrder: "FIRST" }, "FIRST"], ["first", ""], [null, ""], [["first"], ""], [3, ""]]) {
    assert.throws(() => createSheet(opts), thrown("#ARG", cell));
    assert.throws(() => createWorkbook(opts), thrown("#ARG", cell));
    assert.throws(() => loadSheet("not json", opts), thrown("#ARG", cell));
  }
  assert.throws(() => loadSheet("not json", {}), thrown("#LOAD", ""));
  assert.equal(createSheet({ other: 1 }).get("A1"), null);
});

test("cp34h workbooks and loaded sheets", () => {
  const book = createWorkbook({ errorOrder: "first" });
  const main = book.addSheet("Main");
  const data = book.addSheet("Data");
  data.set("A1", "=1/0");
  main.set("A1", "=nope");
  main.set("B1", "=Data!A1+A1");
  main.set("B2", "=A1+Data!A1");
  assert.equal(err(main.get("B1")), "#DIV/0!@A1");
  assert.equal(err(main.get("B2")), "#NAME?@A1");
  book.removeSheet("Data");
  data.set("B1", "=A1+nope");
  assert.equal(err(data.get("B1")), "#DIV/0!@A1");
  const plain = createWorkbook().addSheet("P");
  plain.set("A1", "=1/0");
  plain.set("B1", "=A1+nope");
  assert.equal(err(plain.get("B1")), "#NAME?@B1");
  const saved = fill(createSheet({ errorOrder: "first" })).save();
  assert.equal(saved, fill(createSheet()).save());
  assert.equal(err(loadSheet(saved).get("C1")), "#NAME?@B1");
  assert.equal(err(loadSheet(saved, { errorOrder: "first" }).get("C1")), "#DIV/0!@A1");
});
