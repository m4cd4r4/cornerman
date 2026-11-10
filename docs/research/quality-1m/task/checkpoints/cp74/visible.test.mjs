// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

test("cp74 a 10,000-formula fan-out rereads within budget", () => {
  const s = createSheet();
  s.set("A1", "1");
  for (let r = 1; r <= 9999; r++) s.set(`B${r}`, `=$A$1+${r}`);
  s.set("C1", "=$A$1+1");
  for (let r = 1; r <= 9999; r++) s.get(`B${r}`);
  s.get("C1");
  const before = s.stats().evaluations;
  const t0 = performance.now();
  s.set("A1", "2");
  let sum = s.get("C1");
  for (let r = 1; r <= 9999; r++) sum += s.get(`B${r}`);
  assert.ok(performance.now() - t0 < 1000);
  assert.equal(sum, 50015001);
  assert.equal(s.stats().evaluations - before, 10000);
});

test("cp74 one formula changed back to the same value still re-evaluates its readers", () => {
  const s = createSheet();
  s.setMany({ A1: "1", B1: "=A1*0", C1: "=B1+1", C2: "=B1+2" });
  assert.equal(s.get("C2"), 2);
  s.get("C1");
  const before = s.stats().evaluations;
  s.set("A1", "5");
  assert.equal(s.get("C1"), 1);
  assert.equal(s.get("C2"), 2);
  assert.equal(s.stats().evaluations - before, 3);
});
