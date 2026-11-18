// Floor arm scorer (exploratory). Reads <out>/t1-{floor,cm,full}-sonnet-s<seed>-c3/result.json and
// prints floor pooled acted-on (Wilson 95%), per type, the floor predictions in PROJECT-PLAN.md, and
// retention = (cm - floor) / (full - floor), pooled and per type.
//   node floor-score.mjs <out-dir> [--seeds 1,2,...]
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2];
const si = process.argv.indexOf("--seeds");
const SEEDS = si > 0 ? process.argv[si + 1].split(",").map(Number) : [1, 2, 3, 4, 5, 6, 7, 8];
const load = (arm, s) => {
  const p = join(OUT, `t1-${arm}-sonnet-s${s}-c3`, "result.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
};
const wilson = (k, n) => {
  if (!n) return [NaN, NaN];
  const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(c - h) / d, (c + h) / d];
};
const pct = (x) => (Number.isFinite(x) ? (100 * x).toFixed(1) : "n/a (full = floor) ");
const arms = ["floor", "cm", "full"];
const data = Object.fromEntries(arms.map((a) => [a, SEEDS.map((s) => load(a, s)).filter(Boolean)]));
const missing = SEEDS.filter((s) => !load("floor", s));
if (missing.length) console.log(`Floor trials missing: s${missing.join(", s")}`);
const tally = (a, type) => {
  const xs = data[a].flatMap((r) => r.results).filter((x) => !type || x.type === type);
  return { k: xs.filter((x) => x.acted === "obeyed").length, n: xs.length };
};
console.log(`# Floor arm (${data.floor.length} trials; clears per trial: ${data.floor.map((r) => `s${r.seed}:[${r.clearAt}]`).join(" ")})\n`);
const t = Object.fromEntries(arms.map((a) => [a, tally(a)]));
console.log("| Arm | Acted-on | Rate | Wilson 95% |\n|:--|--:|--:|:--|");
for (const a of arms) { const [lo, hi] = wilson(t[a].k, t[a].n); console.log(`| ${a} | ${t[a].k}/${t[a].n} | ${pct(t[a].k / t[a].n)}% | ${pct(lo)}-${pct(hi)}% |`); }
const ret = (c, f, u) => (u - f > 0 ? (c - f) / (u - f) : NaN);
const r = (x) => x.k / x.n;
console.log(`\nRetention (cm - floor) / (full - floor): ${pct(ret(r(t.cm), r(t.floor), r(t.full)))}%`);
const types = [...new Set(data.floor.flatMap((x) => x.results.map((y) => y.type)))];
console.log("\n| Type | floor | cm | full | retention |\n|:--|--:|--:|--:|--:|");
const perType = types.map((ty) => {
  const [f, c, u] = arms.map((a) => tally(a, ty));
  console.log(`| ${ty} | ${f.k}/${f.n} | ${c.k}/${c.n} | ${u.k}/${u.n} | ${pct(ret(r(c), r(f), r(u)))}% |`);
  return { ty, f: r(f) };
});
const fl = r(t.floor), low = Math.min(...perType.map((x) => x.f));
const lowest = perType.filter((x) => x.f === low).map((x) => x.ty);
console.log(`\n| Prediction | Came true | Value |\n|:--|:--|:--|`);
console.log(`| floor pooled <= 40% (75%) | ${fl <= 0.4 ? "YES" : "no"} | ${pct(fl)}% |`);
console.log(`| floor pooled >= 10% (80%) | ${fl >= 0.1 ? "YES" : "no"} | ${pct(fl)}% |`);
console.log(`| lowest types number and open-question (60%) | ${lowest.every((x) => ["number", "open-question"].includes(x)) && lowest.length ? "YES" : "no"} | lowest: ${lowest.join(", ")} (${pct(low)}%) |`);
if (fl > 0.6) console.log("\nFloor above 60%: report C1 as low sensitivity.");
