// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp64 fill down copies the top cell, moving references", () => {
  const s = createSheet();
  s.set("B1", "2");
  s.set("B2", "3");
  s.set("B3", "4");
  s.set("A1", "=B1*10");
  assert.equal(s.fillDown("A1:A3"), undefined);
  assert.equal(s.getInput("A2"), "=B2*10");
  assert.equal(s.getInput("A3"), "=B3*10");
  assert.equal(s.get("A3"), 40);
});

test("cp64 fill right copies the left cell; two numbers make a series", () => {
  const s = createSheet();
  s.set("A1", "label");
  s.fillRight("A1:C1");
  assert.equal(s.getInput("C1"), "label");
  s.set("A2", "1");
  s.set("B2", "3");
  s.fillRight("A2:D2");
  assert.equal(s.getInput("C2"), "5");
  assert.equal(s.getInput("D2"), "7");
});
