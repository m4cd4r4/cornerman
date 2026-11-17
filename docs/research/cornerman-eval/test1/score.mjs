#!/usr/bin/env node
// Test 1 scorer, per PREDICTIONS.md (frozen 2026-11-17). Reads <out>/t1-<arm>-sonnet-s<seed>-c3/.
//   node score.mjs <out-dir> [--seeds 1,2,...,8] [--json out.json]
// Unit = trial. INVALID trials (no result.json, DRIVER ERROR, TIMEOUT on a probe, a checker-error,
// a usage-limit message) are listed and excluded; rerun them by key (delete the dir, rerun batch.sh).
// Primary: cm - full pooled acted-on, bootstrap B=10,000 over seeds (paired), 95% lower bound > -10.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const OUT = args[0];
if (!OUT) { console.error("usage: score.mjs <out-dir> [--seeds 1,2,3] [--json file]"); process.exit(2); }
const opt = (k, d) => { const i = args.indexOf(k); return i > 0 ? args[i + 1] : d; };
const SEEDS = opt("--seeds", "1,2,3,4,5,6,7,8").split(",").map(Number);
const ARMS = ["cm", "compact", "full"];
const TYPES = ["ruling", "decision", "do-not", "reversed", "open-question", "in-flight", "path", "number"];
const K = 3, MARGIN = -10, B = 10_000;
const USAGE = /usage limit reached|you've hit your (usage )?limit|limit will reset/i;

// ---- load and validate
function load(arm, seed) {
  const dir = join(OUT, `t1-${arm}-sonnet-s${seed}-c3`);
  const why = [];
  if (!existsSync(dir)) return { arm, seed, missing: true, why: ["not run"] };
  const log = existsSync(join(dir, "driver.log")) ? readFileSync(join(dir, "driver.log"), "utf8") : "";
  if (/DRIVER ERROR/.test(log)) why.push("DRIVER ERROR");
  for (const m of log.matchAll(/TIMEOUT waiting for idle after (.+)/g)) (m[1].startsWith("probe") ? why : []).push(`TIMEOUT ${m[1]}`);
  const otherTimeouts = [...log.matchAll(/TIMEOUT waiting for idle after (.+)/g)].map((m) => m[1]).filter((l) => !l.startsWith("probe"));
  if (USAGE.test(log)) why.push("usage limit (driver.log)");
  const tdir = join(dir, "transcripts");
  if (existsSync(tdir)) for (const f of readdirSync(tdir, { recursive: true })) {
    const p = join(tdir, String(f));
    if (String(f).endsWith(".jsonl") && USAGE.test(readFileSync(p, "utf8"))) { why.push(`usage limit (${f})`); break; }
  }
  const rp = join(dir, "result.json");
  if (!existsSync(rp)) return { arm, seed, missing: true, why: [...why, "no result.json"] };
  const r = JSON.parse(readFileSync(rp, "utf8"));
  for (const x of r.results) if (x.acted === "checker-error") why.push(`checker-error ${x.id}`);
  if (r.memoryFiles?.length) why.push(`memoryFiles not empty (${r.memoryFiles.length})`);
  if (r.results.length !== 24) why.push(`${r.results.length} facts, want 24`);
  return { arm, seed, r, why, otherTimeouts };
}
const trials = ARMS.flatMap((a) => SEEDS.map((s) => load(a, s)));
const valid = trials.filter((t) => t.r && !t.why.length);
const get = (arm, seed) => valid.find((t) => t.arm === arm && t.seed === seed);

// ---- stats
const z = 1.959964;
function wilson(k, n) {
  if (!n) return [NaN, NaN];
  const p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [c - h, c + h];
}
function newcombe(k1, n1, k2, n2) { // difference p1 - p2, method 10
  const [l1, u1] = wilson(k1, n1), [l2, u2] = wilson(k2, n2), p1 = k1 / n1, p2 = k2 / n2, d = p1 - p2;
  return [d - Math.sqrt((p1 - l1) ** 2 + (u2 - p2) ** 2), d + Math.sqrt((u1 - p1) ** 2 + (p2 - l2) ** 2)];
}
let rs = 20261117; // seeded so the reported bound is reproducible
const rand = () => ((rs = (Math.imul(rs ^ (rs >>> 15), 2246822507) + 0x6d2b79f5) >>> 0) / 2 ** 32);
const obeyed = (t, type) => t.r.results.filter((x) => (!type || x.type === type) && x.acted === "obeyed").length;
const nfacts = (t, type) => t.r.results.filter((x) => !type || x.type === type).length;
const pct = (x) => (Number.isNaN(x) ? "  n/a" : (100 * x).toFixed(1).padStart(5));
const pts = (x) => (x >= 0 ? "+" : "") + (100 * x).toFixed(1);

function armTotals(arm, type) {
  const ts = valid.filter((t) => t.arm === arm);
  const k = ts.reduce((s, t) => s + obeyed(t, type), 0), n = ts.reduce((s, t) => s + nfacts(t, type), 0);
  return { k, n, p: n ? k / n : NaN, ci: wilson(k, n), trials: ts.length };
}
function pairedBootstrap(a, b) {
  const pairs = SEEDS.filter((s) => get(a, s) && get(b, s)).map((s) => [get(a, s), get(b, s)]);
  if (pairs.length < 2) return { pairs: pairs.length };
  const rate = (sel) => sel.reduce((s, t) => s + obeyed(t), 0) / sel.reduce((s, t) => s + nfacts(t), 0);
  const point = rate(pairs.map((p) => p[0])) - rate(pairs.map((p) => p[1]));
  const ds = [];
  for (let i = 0; i < B; i++) {
    const pick = pairs.map(() => pairs[Math.floor(rand() * pairs.length)]);
    ds.push(rate(pick.map((p) => p[0])) - rate(pick.map((p) => p[1])));
  }
  ds.sort((x, y) => x - y);
  return { pairs: pairs.length, point, lo: ds[Math.floor(0.025 * B)], hi: ds[Math.ceil(0.975 * B) - 1] };
}

// ---- report
const L = [];
const p = (s = "") => L.push(s);
p(`# Test 1 score (${OUT}, seeds ${SEEDS.join(",")})`);
p();
const bad = trials.filter((t) => !t.r || t.why.length);
p(`Valid trials: ${valid.length} of ${trials.length}.`);
for (const t of bad) p(`- ${t.why[0] === "not run" ? "MISSING" : "INVALID"} ${t.arm} s${t.seed}: ${t.why.join("; ")}`);
for (const t of valid) if (t.otherTimeouts?.length) p(`- note ${t.arm} s${t.seed}: non-probe TIMEOUT ${t.otherTimeouts.join(", ")}`);
p();

const prim = pairedBootstrap("cm", "full");
p("## Primary (confirmatory): C1 = cm - full, pooled acted-on");
if (prim.point === undefined) p(`Not computable: ${prim.pairs} complete seed pair(s).`);
else {
  const holds = 100 * prim.lo > MARGIN;
  p(`cm - full = ${pts(prim.point)} points, bootstrap 95% [${pts(prim.lo)}, ${pts(prim.hi)}] over ${prim.pairs} paired seeds (B=${B}).`);
  p(`C1 ${holds ? "HOLDS" : "NOT SHOWN"}: lower bound ${pts(prim.lo)} ${holds ? ">" : "<="} ${MARGIN}.${prim.pairs < SEEDS.length ? ` PROVISIONAL: ${SEEDS.length - prim.pairs} seed pair(s) missing.` : ""}`);
}
p();
p("## Pooled acted-on by arm (Wilson 95%)");
p("| Arm | Trials | Obeyed | Rate | 95% CI |");
p("|:--|--:|--:|--:|:--|");
const tot = Object.fromEntries(ARMS.map((a) => [a, armTotals(a)]));
for (const a of ARMS) p(`| ${a} | ${tot[a].trials} | ${tot[a].k}/${tot[a].n} | ${pct(tot[a].p)}% | ${pct(tot[a].ci[0])}-${pct(tot[a].ci[1])}% |`);
const cvc = pairedBootstrap("cm", "compact"), fvc = pairedBootstrap("full", "compact");
if (cvc.point !== undefined) p(`\nExploratory: cm - compact ${pts(cvc.point)} [${pts(cvc.lo)}, ${pts(cvc.hi)}]; full - compact ${pts(fvc.point)} [${pts(fvc.lo)}, ${pts(fvc.hi)}] (paired bootstrap).`);
p();

p("## Per type (exploratory; 24 facts per arm at n=8)");
p("| Type | cm | compact | full | cm - full (Newcombe 95%) | cm - compact | cm written | leak? |");
p("|:--|--:|--:|--:|:--|:--|--:|:--|");
const cmTrials = valid.filter((t) => t.arm === "cm");
const cmFacts = cmTrials.flatMap((t) => t.r.results.map((x) => ({ ...x, seed: t.seed })));
const isWritten = (x) => Array.isArray(x.written) && x.written.length > 0 && x.written.every(Boolean);
const perType = {};
for (const ty of TYPES) {
  const [c, k, f] = ARMS.map((a) => armTotals(a, ty));
  const ws = cmFacts.filter((x) => x.type === ty), wk = ws.filter(isWritten).length;
  const dF = c.n && f.n ? newcombe(c.k, c.n, f.k, f.n) : [NaN, NaN], dC = c.n && k.n ? newcombe(c.k, c.n, k.k, k.n) : [NaN, NaN];
  const leak = (f.n && f.k - c.k >= 3) || (ws.length && wk / ws.length < 0.9);
  perType[ty] = { c, k, f, wk, wn: ws.length, leak };
  const cell = (t) => `${t.k}/${t.n}`;
  p(`| ${ty} | ${cell(c)} | ${cell(k)} | ${cell(f)} | ${c.n && f.n ? `${pts(c.p - f.p)} [${pts(dF[0])}, ${pts(dF[1])}]` : "n/a"} | ${c.n && k.n ? `${pts(c.p - k.p)} [${pts(dC[0])}, ${pts(dC[1])}]` : "n/a"} | ${wk}/${ws.length} | ${leak ? "LEAK" : ""} |`);
}
p();

p("## Failure classes (exploratory)");
for (const a of ARMS) {
  const xs = valid.filter((t) => t.arm === a).flatMap((t) => t.r.results.map((x) => ({ ...x, seed: t.seed }))).filter((x) => x.acted !== "obeyed");
  p(`- ${a}: ${xs.length} miss(es)${xs.length ? ": " + Object.entries(xs.reduce((m, x) => ((m[x.acted] = (m[x.acted] ?? 0) + 1), m), {})).map(([k2, v]) => `${k2} ${v}`).join(", ") : ""}`);
  for (const x of xs) p(`  - s${x.seed} ${x.id} ${x.acted}${a === "cm" ? (isWritten(x) ? " [written, not acted on]" : x.written?.length ? " [not written]" : " [no handover after plant]") : ""}: ${String(x.detail ?? "").slice(0, 140)}`);
}
const staleN = cmFacts.filter((x) => Array.isArray(x.stale) && x.stale.some(Boolean)).length, staleOf = cmFacts.filter((x) => Array.isArray(x.stale)).length;
p(`- cm reversed facts with the superseded wording still in a handover (stale): ${staleN}/${staleOf}`);
p();

p("## cm clears");
for (const t of cmTrials) p(`- s${t.seed}: clearsInWork ${t.r.clearsInWork}, clearsAfterLate ${t.r.clearsAfterLate}, clearAt [${t.r.clearAt}], sessions ${t.r.sessions}, handovers ${t.r.handovers}`);
p();

// ---- predictions
const yes = (b) => (b === null ? "n/a" : b ? "YES" : "no");
const wAll = cmFacts.length ? cmFacts.filter(isWritten).length / cmFacts.length : NaN;
const cmRates = TYPES.map((ty) => [ty, perType[ty].c.n ? perType[ty].c.p : NaN]).filter(([, r]) => !Number.isNaN(r));
const lowest = cmRates.length ? Math.min(...cmRates.map(([, r]) => r)) : NaN;
const lowestTypes = cmRates.filter(([, r]) => r === lowest).map(([ty]) => ty);
const P = [
  ["P1", "full pooled >= 90%", tot.full.n ? tot.full.p >= 0.9 : null, `${pct(tot.full.p)}%`],
  ["P2", "C1 holds (lower bound > -10)", prim.lo === undefined ? null : 100 * prim.lo > MARGIN, prim.lo === undefined ? "" : pts(prim.lo)],
  ["P3", "compact below full by >= 5 points", tot.full.n && tot.compact.n ? tot.full.p - tot.compact.p >= 0.05 : null, tot.full.n && tot.compact.n ? pts(tot.full.p - tot.compact.p) : ""],
  ["P4", "cm above compact pooled", tot.cm.n && tot.compact.n ? tot.cm.p > tot.compact.p : null, tot.cm.n && tot.compact.n ? pts(tot.cm.p - tot.compact.p) : ""],
  ["P5", "cm lowest type is reversed or open-question", cmRates.length ? lowestTypes.every((t) => t === "reversed" || t === "open-question") : null, `lowest: ${lowestTypes.join(", ")} (${pct(lowest)}%)${lowestTypes.length > 1 ? " TIE" : ""}`],
  ["P6", "cm written pooled >= 90%", cmFacts.length ? wAll >= 0.9 : null, `${pct(wAll)}%`],
  ["P7", "a cm miss is written but not acted on", cmFacts.length ? cmFacts.some((x) => x.acted !== "obeyed" && isWritten(x)) : null, `${cmFacts.filter((x) => x.acted !== "obeyed" && isWritten(x)).length}`],
  ["P8", "cm clearsInWork >= K in >= 7 of 8", cmTrials.length ? cmTrials.filter((t) => t.r.clearsInWork >= K).length >= 7 : null, `${cmTrials.filter((t) => t.r.clearsInWork >= K).length} of ${cmTrials.length}`],
];
p("## Predictions");
p("| # | Prediction | Came true | Value |");
p("|:--|:--|:--|:--|");
for (const [id, txt, b, v] of P) p(`| ${id} | ${txt} | ${yes(b)} | ${v} |`);

console.log(L.join("\n"));
const j = opt("--json");
if (j) (await import("node:fs")).writeFileSync(j, JSON.stringify({ seeds: SEEDS, invalid: bad.map((t) => ({ arm: t.arm, seed: t.seed, why: t.why })), primary: prim, totals: tot, perType, predictions: P }, null, 1));
