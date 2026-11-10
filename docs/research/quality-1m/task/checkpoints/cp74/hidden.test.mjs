// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSheet, createWorkbook } from "../../src/index.mjs";

const timed = (f) => { const t0 = performance.now(); const v = f(); return [v, performance.now() - t0]; };
const ADDRS = [...Array.from({ length: 9999 }, (_, i) => `B${i + 1}`), "C1"];

// Budget 1's sheet, every formula read once.
function wide() {
  const s = createSheet();
  s.set("A1", "1");
  for (let r = 1; r <= 9999; r++) s.set(`B${r}`, `=$A$1+${r}`);
  s.set("C1", "=$A$1+1");
  for (const a of ADDRS) s.get(a);
  return s;
}
const total = (s) => ADDRS.reduce((t, a) => t + s.get(a), 0);
const evals = (s, f) => { const b = s.stats().evaluations; f(); return s.stats().evaluations - b; };

test("cp74h wide fan-out: change and reread within budget, exactly 10,000 evaluations", () => {
  const s = wide();
  assert.equal(s.stats().evaluations, 10000);
  const [sum, ms] = timed(() => { s.set("A1", "2"); return total(s); });
  assert.ok(ms < 1000, `reread took ${ms} ms`);
  assert.equal(sum, 50015001);
  assert.equal(s.stats().evaluations, 20000);
  assert.equal(s.get("B9999"), 10001);
  assert.equal(s.get("C1"), 3);
  assert.equal(evals(s, () => total(s)), 0);
  assert.equal(evals(s, () => { s.undo(); assert.equal(total(s), 50005001); }), 10000);
  assert.equal(evals(s, () => { s.redo(); total(s); }), 10000);
  assert.equal(evals(s, () => { s.set("A1", "2"); total(s); }), 0);
});

test("cp74h dependents of a 10,000-formula fan-out within budget, row-major", () => {
  const s = wide();
  const [deps, ms] = timed(() => s.dependents("A1"));
  assert.ok(ms < 1000, `dependents took ${ms} ms`);
  assert.equal(deps.length, 10000);
  assert.deepEqual(deps.slice(0, 4), ["B1", "C1", "B2", "B3"]);
  assert.equal(deps[9999], "B9999");
  const [trans, ms2] = timed(() => s.dependents("A1", { transitive: true }));
  assert.ok(ms2 < 1000, `transitive dependents took ${ms2} ms`);
  assert.deepEqual(trans, deps);
  assert.deepEqual(s.dependents("B7"), []);
});

test("cp74h layers: every cell reached through many paths is evaluated once, within budget", () => {
  const s = createSheet();
  s.set("A1", "1");
  for (let r = 1; r <= 60; r++) s.set(`B${r}`, `=$A$1+${r}`);
  for (const [x, c] of [["B", "C"], ["C", "D"], ["D", "E"]]) for (let r = 1; r <= 60; r++) s.set(`${c}${r}`, `=SUM(${x}$1:${x}$60)+${r}`);
  for (let r = 1; r <= 60; r++) s.get(`E${r}`);
  assert.equal(s.stats().evaluations, 240);
  assert.equal(s.get("E1"), 6915631);
  const [top, ms] = timed(() => { s.set("A1", "2"); let t = 0; for (let r = 1; r <= 60; r++) t += s.get(`E${r}`); return t; });
  assert.ok(ms < 1000, `layers took ${ms} ms`);
  assert.equal(s.stats().evaluations, 480);
  assert.equal(s.get("E1"), 7131631);
  assert.equal(top, 60 * 7131630 + 1830);
  assert.equal(evals(s, () => { s.set("B30", "=$A$1+30"); s.get("E60"); }), 0);
  assert.equal(evals(s, () => { s.set("B30", "=$A$1+31"); s.get("E60"); }), 1 + 60 + 60 + 1);
});

test("cp74h changes beside a fan-out cost nothing, within budget", () => {
  const s = wide();
  const [sum, ms] = timed(() => {
    let t = 0;
    for (let i = 1; i <= 2000; i++) {
      s.set(`E${i}`, String(i));
      t += s.get(`B${i}`);
    }
    return t;
  });
  assert.ok(ms < 1000, `2,000 pairs took ${ms} ms`);
  assert.equal(sum, 2000 + 2001000);
  assert.equal(s.stats().evaluations, 10000);
  assert.equal(evals(s, () => { s.set("A1", "3"); assert.equal(s.get("B5000"), 5003); }), 1);
  assert.equal(evals(s, () => total(s)), 9999);
});

test("cp74h no early cut-off: the same value still re-evaluates every reader", () => {
  const s = createSheet();
  s.setMany({ A1: "1", B1: "=A1*0" });
  for (let r = 1; r <= 1000; r++) s.set(`C${r}`, `=B1+${r}`);
  const read = () => { let t = 0; for (let r = 1; r <= 1000; r++) t += s.get(`C${r}`); return t; };
  assert.equal(read(), 500500);
  assert.equal(evals(s, () => { s.set("A1", "7"); assert.equal(read(), 500500); }), 1001);
  assert.equal(evals(s, () => { s.set("A1", "7.0"); assert.equal(read(), 500500); }), 1001);
  assert.equal(evals(s, () => { s.set("A1", "7.0"); read(); }), 0);
  assert.equal(evals(s, () => { s.setMany({ A1: "7.0", D1: "x" }); read(); }), 0);
  assert.equal(evals(s, () => { s.set("B1", "=A1*0+0"); read(); }), 1001);
});

test("cp74h a reference in an untaken IF branch is a dependent and is evaluated again", () => {
  const s = createSheet();
  s.set("A1", "1");
  for (let r = 1; r <= 1000; r++) s.set(`B${r}`, r % 2 ? "=IF(FALSE, A1, 0)" : "=IFERROR(5, A1)");
  const read = () => { let t = 0; for (let r = 1; r <= 1000; r++) t += s.get(`B${r}`); return t; };
  assert.equal(read(), 2500);
  assert.equal(s.dependents("A1").length, 1000);
  assert.equal(evals(s, () => { s.set("A1", "2"); assert.equal(read(), 2500); }), 1000);
});

test("cp74h fan-out through ranges, names and other sheets", () => {
  const b = createWorkbook();
  const m = b.addSheet("Main");
  const d = b.addSheet("Data");
  d.setMany({ A1: "1", A2: "10" });
  b.defineName("K", "Data!A1");
  for (let r = 1; r <= 1000; r++) m.setMany({ [`B${r}`]: "=Data!$A$1*2", [`C${r}`]: "=SUM(Data!$A$1:$A$2)", [`D${r}`]: "=K+1" });
  const read = () => { let t = 0; for (let r = 1; r <= 1000; r++) t += m.get(`B${r}`) + m.get(`C${r}`) + m.get(`D${r}`); return t; };
  assert.equal(read(), 1000 * (2 + 11 + 2));
  assert.equal(evals(m, () => { d.set("A2", "20"); assert.equal(read(), 1000 * (2 + 21 + 2)); }), 1000);
  assert.equal(evals(m, () => { d.set("A1", "2"); assert.equal(read(), 1000 * (4 + 22 + 3)); }), 3000);
  assert.equal(evals(m, () => { d.set("A3", "5"); read(); }), 0);
  assert.equal(d.dependents("A1").length, 3000);
  assert.equal(d.dependents("A1")[0], "Main!B1");
});

test("cp74h after a change, reading one reader evaluates it alone; recalc takes the rest in order", () => {
  const s = wide();
  s.set("A1", "4");
  assert.equal(evals(s, () => assert.equal(s.get("B5000"), 5004)), 1);
  assert.equal(evals(s, () => assert.equal(s.display("C1"), "5")), 1);
  let order;
  assert.equal(evals(s, () => { order = s.recalc(); }), 9998);
  assert.equal(order.length, 9998);
  assert.deepEqual(order.slice(0, 3), ["B1", "B2", "B3"]);
  assert.equal(order[4998], "B4999");
  assert.equal(order[4999], "B5001");
  assert.deepEqual(s.recalc(), []);
});

test("cp74h inserting a row above a fan-out rewrites and re-evaluates every reader once", () => {
  const s = createSheet();
  s.set("A1", "1");
  for (let r = 1; r <= 1000; r++) s.set(`B${r}`, `=$A$1+${r}`);
  const read = (k) => { let t = 0; for (let r = 1 + k; r <= 1000 + k; r++) t += s.get(`B${r}`); return t; };
  assert.equal(read(0), 1000 + 500500);
  s.insertRows(1);
  assert.equal(s.getInput("B1001"), "=$A$2+1000");
  assert.deepEqual(s.dependents("A2").slice(0, 2), ["B2", "B3"]);
  assert.equal(evals(s, () => assert.equal(read(1), 1000 + 500500)), 1000);
  assert.equal(evals(s, () => { s.set("A1", "9"); read(1); }), 0);
  assert.equal(evals(s, () => { s.set("A2", "2"); assert.equal(read(1), 2000 + 500500); }), 1000);
});

test("cp74h CHANGES.md has a cp74 line that is not the bare title", () => {
  const lines = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  assert.ok(lines.length >= 74);
  assert.match(lines[73], /^- cp74: \S/);
  assert.notEqual(lines[73].slice(8).toLowerCase(), "performance budget for wide fan-out");
});
