// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp51 find lists the cells whose input holds the text", () => {
  const s = createSheet();
  s.set("A1", "red apple");
  s.set("B1", "green");
  s.set("A2", "Red wine");
  assert.deepEqual(s.find("red"), ["A1", "A2"]);
  assert.deepEqual(s.find("blue"), []);
});

test("cp51 replace changes inputs and returns the cells changed", () => {
  const s = createSheet();
  s.set("A1", "red apple");
  s.set("A2", "=LEN(\"red\")");
  assert.equal(s.replace("red", "blue"), 2);
  assert.equal(s.getInput("A1"), "blue apple");
  assert.equal(s.get("A2"), 4);
});
