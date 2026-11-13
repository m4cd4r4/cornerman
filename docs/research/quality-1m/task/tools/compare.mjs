#!/usr/bin/env node
// tdd-guard:allow - research analysis; bootstrap checked by --selftest.
// compare.mjs: late-segment pass rate per arm vs a base arm (Default), bootstrap 95% interval,
// and the verdict word of the frozen claim rule.
//   node compare.mjs --k <K> --runs <dir holding <arm>-<model>-rN/score.json> [--model sonnet] [--base default] [--md <file>]
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

// Chat-only layer: sums the `summary.chat` blocks of score.json files ({ total, passed, early, late }).
// Runs scored before the layer existed have none and are left out. Reported beside the primary late
// rate, never folded into it.
export function chatTotals(summaries) {
  const t = { runs: 0, total: 0, passed: 0, early: { total: 0, passed: 0 }, late: { total: 0, passed: 0 } };
  for (const s of summaries) {
    const c = s?.chat;
    if (!c) continue;
    t.runs++;
    for (const k of ["total", "passed"]) { t[k] += c[k]; t.early[k] += c.early[k]; t.late[k] += c.late[k]; }
  }
  return t;
}
const chatCell = (t) => (t.runs ? `${t.passed}/${t.total} (cp35-58 ${t.early.passed}/${t.early.total}; cp59-80 ${t.late.passed}/${t.late.total})` : "-");

if (process.argv.includes("--selftest")) {
  const ones = Array(20).fill(1), zeros = Array(20).fill(0);
  const same = pairedBootstrap([ones, zeros], [ones, zeros]);
  const better = pairedBootstrap([ones, ones, ones], [zeros, zeros, zeros]);
  const mixed = pairedBootstrap([[1, 1, 1, 0, 0, 1, 1, 1, 1, 0]], [[1, 0, 1, 0, 0, 1, 0, 1, 1, 0]]);
  const word = (b) => (b.lo > 0 ? "helps" : b.hi < 0 ? "hurts" : "none");
  const worse = pairedBootstrap([zeros, zeros, zeros], [ones, ones, ones]);
  const ok = Math.abs(same.diff) < 1e-12 && better.diff === 1 && better.lo === 1 && Math.abs(mixed.diff - 0.2) < 1e-12 && mixed.lo <= 0.2 && mixed.hi >= 0.2
    && word(better) === "helps" && word(worse) === "hurts" && word(same) === "none" && word({ lo: 0, hi: 0.1 }) === "none";
  const chatRun = (e, ep, l, lp) => ({ chat: { total: e + l, passed: ep + lp, early: { total: e, passed: ep }, late: { total: l, passed: lp } } });
  const sum = chatTotals([chatRun(8, 8, 12, 5), chatRun(8, 6, 12, 1), { ruleViolations: 0 }, undefined]);
  const chatOk = sum.runs === 2 && sum.total === 40 && sum.passed === 20 && sum.early.total === 16 && sum.early.passed === 14
    && sum.late.total === 24 && sum.late.passed === 6 && chatTotals([{}]).runs === 0
    && chatCell(sum) === "20/40 (cp35-58 14/16; cp59-80 6/24)" && chatCell(chatTotals([])) === "-";
  console.log(ok && chatOk ? "COMPARE SELFTEST OK" : `COMPARE SELFTEST FAIL ${JSON.stringify({ same, better, mixed, sum })}`);
  process.exit(ok && chatOk ? 0 : 1);
}

// --fork: the fill dial (harness/fork.mjs). Runs are fork-<arm>-<model>-rN under _q1m-fork, every
// arm starts from pilot 3 at cp44, so K is 44 and the base is the natural fork.
const FORK = process.argv.includes("--fork");
const K = FORK ? 44 : Number(arg("--k"));
const DIR = arg("--runs", FORK ? "I:/Scratch/_q1m-fork" : "I:/Scratch/_q1m");
const MODEL = arg("--model", "sonnet");
if (!K) throw new Error("need --k");
if (FORK && arg("--k") && Number(arg("--k")) !== 44) throw new Error("--fork fixes K at 44");
const byArm = new Map(), invalid = [];
for (const name of readdirSync(DIR)) {
  const m = (FORK ? /^fork-(natural|fill\d+|compact|clear)-(\w+)-r(\d+)$/ : /^(default|compact250|cm\d+)-(\w+)-r(\d+)$/).exec(name);
  if (!m || m[2] !== MODEL) continue;
  if (existsSync(join(DIR, name, "out", "INVALID"))) { invalid.push(name); continue; }
  const f = join(DIR, name, "score.json");
  if (!existsSync(f)) continue;
  const j = JSON.parse(readFileSync(f, "utf8"));
  const late = j.rows.slice(K - 1).map((r) => (r.pass ? 1 : 0));
  if (!byArm.has(m[1])) byArm.set(m[1], []);
  byArm.get(m[1]).push({ name, late, s: j.summary });
}
const order = (FORK ? ["natural", "fill700", "fill900", "compact", "clear"] : ["default", "compact250", "cm180", "cm250", "cm350", "cm500"]).filter((a) => byArm.has(a));
// --base picks the arm every other arm is compared with. Only cm250 vs default is confirmatory
// (PREDICTIONS.md); every other pair, and any other base, is exploratory and labelled so.
const BASE = arg("--base", FORK ? "natural" : "default");
if (!order.includes(BASE) && byArm.size) throw new Error(`--base ${BASE} has no scored run`);
const base = byArm.get(BASE);
// The frozen claim rule. A bound of exactly 0 spans 0: the interval must exclude it.
const verdict = (b, n) => (b.lo > 0 ? "helps" : b.hi < 0 ? "hurts" : `no large effect at n = ${n}`);
const lastCp = Math.max(0, ...[...byArm.values()].flat().map((r) => K - 1 + r.late.length));
const lines = [`Late segment cp${String(K).padStart(2, "0")}-cp${String(lastCp).padStart(2, "0")}, ${MODEL}.`, "",
  `| Arm | Runs | Late pass | vs ${BASE} (95% interval) | Verdict | Chat pass (all runs) | Regressions | Rule violations (distinct) | Probes right | Peak context | Work tokens |`,
  "|:--|--:|--:|:--|:--|:--|--:|--:|--:|--:|--:|"];
for (const a of order) {
  const runs = byArm.get(a);
  const passN = runs.reduce((s, r) => s + r.late.reduce((x, y) => x + y, 0), 0), tot = runs.reduce((s, r) => s + r.late.length, 0);
  let vs = "-", word = "-";
  if (a !== BASE && base) {
    const b = pairedBootstrap(runs.map((r) => r.late), base.map((r) => r.late));
    vs = `${(b.diff * 100).toFixed(1)} pts (${(b.lo * 100).toFixed(1)} to ${(b.hi * 100).toFixed(1)})`;
    word = `${verdict(b, Math.min(runs.length, base.length))}${a === "cm250" && BASE === "default" ? "" : " (exploratory)"}`;
  }
  const sum = (f) => runs.map(f).join(", ");
  lines.push(`| ${a} | ${runs.length} | ${passN}/${tot} | ${vs} | ${word} | ${chatCell(chatTotals(runs.map((r) => r.s)))} | ${sum((r) => r.s.regressions)} | ${sum((r) => `${r.s.ruleViolations} (${r.s.ruleViolationsDistinct ?? "?"})`)} | ${sum((r) => `${r.s.probesRight}/${r.s.probesTotal}`)} | ${sum((r) => r.s.tokens?.peak ?? "?")} | ${sum((r) => r.s.tokens?.work ?? "?")} |`);
}
if (invalid.length) lines.push("", `INVALID, excluded: ${invalid.join(", ")}`);
const text = lines.join("\n");
console.log(text);
if (arg("--md")) writeFileSync(arg("--md"), text + "\n");
