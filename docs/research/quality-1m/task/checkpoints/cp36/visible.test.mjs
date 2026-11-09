// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet } from "../../src/index.mjs";

// i-th cell (1-based) of the chain: A1..A9999, then B1.
const at = (i) => (i <= 9999 ? `A${i}` : `B${i - 9999}`);

test("cp36 a 10,000-formula chain reads within budget", () => {
  const s = createSheet();
  s.set("Z1", "1");
  s.set("A1", "=Z1+1");
  for (let i = 2; i <= 10000; i++) s.set(at(i), `=${at(i - 1)}+1`);
  const t0 = performance.now();
  assert.equal(s.get("B1"), 10001);
  assert.ok(performance.now() - t0 < 2000);
  assert.equal(s.stats().evaluations, 10000);
});
