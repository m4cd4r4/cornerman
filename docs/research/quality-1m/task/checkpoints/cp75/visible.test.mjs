// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp75 cell gives input, value and text together", () => {
  const s = createSheet();
  s.setCell("A1", "2");
  s.setCell("b1", "=A1/4");
  assert.deepEqual(s.cell("b1"), { address: "B1", input: "=A1/4", value: 0.5, text: "0.5" });
  assert.deepEqual(s.cell("C9"), { address: "C9", input: "", value: null, text: "" });
});

test("cp75 clear removes inputs as one undo step", () => {
  const s = createSheet();
  s.setMany({ A1: "1", A2: "2", B2: "x" });
  assert.equal(s.clear("A1:B2"), 3);
  assert.deepEqual(s.addresses(), []);
  s.undo();
  assert.deepEqual(s.addresses(), ["A1", "A2", "B2"]);
});

test("cp75 the old names are logged, the new ones are not", () => {
  const s = createSheet();
  s.setCell("A1", "1");
  s.value("A1");
  assert.deepEqual(s.deprecations(), []);
  s.set("A2", "2");
  s.get("A2");
  s.get("A1");
  assert.deepEqual(s.deprecations(), [{ name: "set", use: "setCell", calls: 1 }, { name: "get", use: "value", calls: 2 }]);
});
