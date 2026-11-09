#!/usr/bin/env node
// tdd-guard:allow - research analysis; bootstrap checked by --selftest.
// compare.mjs: late-segment pass rate per arm vs Default, paired bootstrap 95% interval.
//   node compare.mjs --k <K> --runs <dir holding <arm>-<model>-rN/score.json> [--model sonnet] [--md <file>]
//   node compare.mjs --selftest
// Pairing: for arm A vs Default, each bootstrap draw resamples run indices (with replacement)
// within each arm and late checkpoints (shared across arms), so a checkpoint that is hard for
// everyone counts against both. INVALID runs (out/INVALID present) are skipped and listed.
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function arg(n, d = null) { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; }

// Deterministic PRNG so the interval is reproducible.
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// runs: arrays of 0/1 per late checkpoint, one array per run. Returns mean and 95% interval of A - B.
export function pairedBootstrap(a, b, B = 10000, seed = 1) {
  const r = rng(seed);
  const m = a[0].length;
  const rate = (runs, idx, cps) => { let s = 0; for (const i of idx) for (const c of cps) s += runs[i][c]; return s / (idx.length * cps.length); };
  const all = (n) => [...Array(n).keys()];
  const point = rate(a, all(a.length), all(m)) - rate(b, all(b.length), all(m));
  const d = [];
  for (let k = 0; k < B; k++) {
    const cps = all(m).map(() => Math.floor(r() * m));
    const ia = all(a.length).map(() => Math.floor(r() * a.length));
    const ib = all(b.length).map(() => Math.floor(r() * b.length));
    d.push(rate(a, ia, cps) - rate(b, ib, cps));
  }
  d.sort((x, y) => x - y);
  return { diff: point, lo: d[Math.floor(0.025 * B)], hi: d[Math.floor(0.975 * B) - 1] };
}

if (process.argv.includes("--selftest")) {
  const ones = Array(20).fill(1), zeros = Array(20).fill(0);
  const same = pairedBootstrap([ones, zeros], [ones, zeros]);
  const better = pairedBootstrap([ones, ones, ones], [zeros, zeros, zeros]);
  const mixed = pairedBootstrap([[1, 1, 1, 0, 0, 1, 1, 1, 1, 0]], [[1, 0, 1, 0, 0, 1, 0, 1, 1, 0]]);
  const ok = Math.abs(same.diff) < 1e-12 && better.diff === 1 && better.lo === 1 && Math.abs(mixed.diff - 0.2) < 1e-12 && mixed.lo <= 0.2 && mixed.hi >= 0.2;
  console.log(ok ? "COMPARE SELFTEST OK" : `COMPARE SELFTEST FAIL ${JSON.stringify({ same, better, mixed })}`);
  process.exit(ok ? 0 : 1);
}

const K = Number(arg("--k"));
const DIR = arg("--runs", "I:/Scratch/_q1m");
const MODEL = arg("--model", "sonnet");
if (!K) throw new Error("need --k");
const byArm = new Map(), invalid = [];
for (const name of readdirSync(DIR)) {
  const m = /^(default|compact250|cm\d+)-(\w+)-r(\d+)$/.exec(name);
  if (!m || m[2] !== MODEL) continue;
  if (existsSync(join(DIR, name, "out", "INVALID"))) { invalid.push(name); continue; }
  const f = join(DIR, name, "score.json");
  if (!existsSync(f)) continue;
  const j = JSON.parse(readFileSync(f, "utf8"));
  const late = j.rows.slice(K - 1).map((r) => (r.pass ? 1 : 0));
  if (!byArm.has(m[1])) byArm.set(m[1], []);
  byArm.get(m[1]).push({ name, late, s: j.summary });
}
const order = ["default", "compact250", "cm180", "cm250", "cm350", "cm500"].filter((a) => byArm.has(a));
const base = byArm.get("default");
const lastCp = Math.max(0, ...[...byArm.values()].flat().map((r) => K - 1 + r.late.length));
const lines = [`Late segment cp${String(K).padStart(2, "0")}-cp${String(lastCp).padStart(2, "0")}, ${MODEL}.`, "",
  "| Arm | Runs | Late pass | vs Default (95% interval) | Regressions | Rule violations | Probes right | Peak context | Work tokens |",
  "|:--|--:|--:|:--|--:|--:|--:|--:|--:|"];
for (const a of order) {
  const runs = byArm.get(a);
  const passN = runs.reduce((s, r) => s + r.late.reduce((x, y) => x + y, 0), 0), tot = runs.reduce((s, r) => s + r.late.length, 0);
  let vs = "-";
  if (a !== "default" && base) {
    const b = pairedBootstrap(runs.map((r) => r.late), base.map((r) => r.late));
    vs = `${(b.diff * 100).toFixed(1)} pts (${(b.lo * 100).toFixed(1)} to ${(b.hi * 100).toFixed(1)})`;
  }
  const sum = (f) => runs.map(f).join(", ");
  lines.push(`| ${a} | ${runs.length} | ${passN}/${tot} | ${vs} | ${sum((r) => r.s.regressions)} | ${sum((r) => r.s.ruleViolations)} | ${sum((r) => `${r.s.probesRight}/${r.s.probesTotal}`)} | ${sum((r) => r.s.tokens?.peak ?? "?")} | ${sum((r) => r.s.tokens?.work ?? "?")} |`);
}
if (invalid.length) lines.push("", `INVALID, excluded: ${invalid.join(", ")}`);
const text = lines.join("\n");
console.log(text);
if (arg("--md")) writeFileSync(arg("--md"), text + "\n");
