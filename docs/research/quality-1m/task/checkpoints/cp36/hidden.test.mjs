// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const N = 10000;
// i-th cell (1-based) of a run down column L: L1..L9999, then the next column.
const at = (i, L = "A") => (i <= 9999 ? `${L}${i}` : `${String.fromCharCode(L.charCodeAt(0) + 1)}${i - 9999}`);
const err = (v) => (v && typeof v === "object" ? `${v.code}@${v.cell}` : v);
const timed = (f) => { const t0 = performance.now(); const v = f(); return [v, performance.now() - t0]; };

test("cp36h chain read and reread within budget, exact counts", () => {
  const s = createSheet();
  s.set("Z1", "1");
  s.set("A1", "=Z1+1");
  for (let i = 2; i <= N; i++) s.set(at(i), `=${at(i - 1)}+1`);
  let [v, ms] = timed(() => s.get("B1"));
  assert.equal(v, 10001);
  assert.ok(ms < 2000, `read took ${ms} ms`);
  assert.equal(s.stats().evaluations, 10000);
  [v, ms] = timed(() => { s.set("Z1", "2"); return s.get("B1"); });
  assert.equal(v, 10002);
  assert.ok(ms < 2000, `reread took ${ms} ms`);
  assert.equal(s.stats().evaluations, 20000);
  assert.equal(s.get("A5000"), 5002);
  assert.equal(s.display("B1"), "10002");
  assert.equal(s.stats().evaluations, 20000);
  s.set("Z1", "=1/0");
  assert.equal(err(s.get("B1")), "#DIV/0!@Z1");
});

test("cp36h many small changes within budget", () => {
  const s = createSheet();
  for (let i = 1; i <= N; i++) s.set(at(i, "D"), `=${i}*2`);
  const [sum, ms] = timed(() => {
    let t = 0;
    for (let i = 1; i <= 2000; i++) {
      s.set(at(i, "H"), `=${at(i, "D")}+1`);
      t += s.get(at(i, "H"));
    }
    return t;
  });
  assert.equal(sum, 4004000);
  assert.ok(ms < 3000, `2,000 pairs took ${ms} ms`);
  assert.equal(s.stats().evaluations, 4000);
});

test("cp36h deep chains in any build order and across sheets", () => {
  const s = createSheet();
  for (let i = N; i >= 2; i--) s.set(at(i), `=${at(i - 1)}+1`);
  s.set("A1", "1");
  assert.equal(s.get(at(N)), 10000);
  assert.equal(s.get(at(N - 1)), 9999);
  const b = createWorkbook();
  const x = b.addSheet("X_");
  const y = b.addSheet("Y_");
  x.set("A1", "1");
  for (let i = 2; i <= N; i++) (i % 2 ? x : y).set(at(i), `=${i % 2 ? "Y_" : "X_"}!${at(i - 1)}+1`);
  assert.equal(y.get(at(N)), 10000);
  assert.equal(x.stats().evaluations + y.stats().evaluations, N - 1);
  x.set("A1", "5");
  assert.equal(y.get(at(N)), 10004);
  assert.equal(x.stats().evaluations + y.stats().evaluations, 2 * (N - 1));
});

test("cp36h deep cycles, and breaking them", () => {
  const s = createSheet();
  for (let i = 2; i <= N; i++) s.set(at(i), `=${at(i - 1)}+1`);
  s.set("A1", `=${at(N)}+1`);
  s.set("C1", "=A5000*2");
  assert.equal(err(s.get("A5000")), "#CYCLE!@A5000");
  assert.equal(err(s.get(at(N))), "#CYCLE!@B1");
  assert.equal(err(s.get("C1")), "#CYCLE!@A5000");
  s.set("A1", "1");
  assert.equal(s.get(at(N)), 10000);
  assert.equal(s.get("C1"), 10000);
  s.set("A1", `=${at(N)}`);
  assert.equal(err(s.get("C1")), "#CYCLE!@A5000");
  s.set("A1", "=A1");
  assert.equal(err(s.get("A1")), "#CYCLE!@A1");
  assert.equal(err(s.get("C1")), "#CYCLE!@A1");
  s.set("A1", "");
  assert.equal(s.get("C1"), 9998);
});

test("cp36h laziness and small cycle changes still exact", () => {
  const s = createSheet();
  s.set("Z1", "1");
  s.set("A1", "=Z1+1");
  for (let i = 2; i <= N; i++) s.set(at(i), `=${at(i - 1)}+1`);
  s.set("C1", "=IF(TRUE, 7, B1)");
  assert.equal(s.get("C1"), 7);
  assert.equal(s.stats().evaluations, 1);
  s.set("C2", "=IF(Z1>0, B1, 0)");
  assert.equal(s.get("C2"), 10001);
  assert.equal(s.stats().evaluations, 1 + 1 + N);
  const t = createSheet();
  t.set("A1", "=B1");
  t.set("B1", "=1");
  t.set("C1", "=A1+1");
  assert.equal(t.get("C1"), 2);
  t.set("B1", "=A1");
  assert.equal(err(t.get("C1")), "#CYCLE!@A1");
  assert.equal(err(t.get("B1")), "#CYCLE!@B1");
  t.set("B1", "2");
  assert.equal(t.get("C1"), 3);
  t.set("D1", "=D2");
  t.set("D2", "=D1");
  assert.equal(err(t.get("D1")), "#CYCLE!@D1");
  assert.equal(t.get("C1"), 3);
  assert.equal(t.get("A1"), 2);
});
