#!/usr/bin/env node
// tdd-guard:allow - research scorer, proven by tools/probe-selftest.mjs.
// Score the recall probes the agent wrote into PROBES.md against harness/probes.json.
//   node check-probes.mjs --answers <repo>/PROBES.md [--git <repo>] [--key <probes.json>] [--json]
// Answer lines look like `P1.3: 1e-9`. A missing line scores wrong. Exact match after the
// normalisation below; no judge. git-files answers are keyed from the run's own git history.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
function arg(n) { const i = process.argv.indexOf(n); return i === -1 ? null : process.argv[i + 1]; }
const ANSWERS = arg("--answers");
const GIT = arg("--git");
const KEY = arg("--key") || resolve(HERE, "..", "harness", "probes.json");
const JSON_OUT = process.argv.includes("--json");
if (!ANSWERS) throw new Error("need --answers <PROBES.md>");

const given = new Map();
if (existsSync(ANSWERS)) {
  for (const line of readFileSync(ANSWERS, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*[-*]?\s*\**(P\d+\.\d+)\**\s*[:=]\s*(.*)$/i);
    if (m) given.set(m[1].toUpperCase(), m[2].trim());
  }
}

const unwrap = (s) => s.trim().replace(/^[`"']+|[`"']+$/g, "").trim();
const norm = (s) => unwrap(s).replace(/\s+/g, " ").toLowerCase();
const list = (s) => unwrap(s).split(/\s*[,;]\s*/).map(unwrap).filter(Boolean);
const cpOf = (s) => { const m = norm(s).match(/^(?:cp|checkpoint)\s*0*(\d{1,2})$/); return m ? `cp${m[1].padStart(2, "0")}` : null; };
const path = (s) => unwrap(s).replace(/\\/g, "/").replace(/^\.\//, "");

function gitFiles(cp) {
  if (!GIT) return null;
  const log = spawnSync("git", ["log", "--format=%H %s"], { cwd: GIT, encoding: "utf8" });
  if (log.status !== 0) return null;
  const hit = log.stdout.split("\n").find((l) => new RegExp(`^\\w+ ${cp}: \\S`).test(l));
  if (!hit) return [];
  const show = spawnSync("git", ["show", "--name-only", "--format=", hit.split(" ")[0]], { cwd: GIT, encoding: "utf8" });
  return show.stdout.split("\n").map((s) => s.trim()).filter((f) => f.startsWith("src/")).sort();
}

function score(q, raw) {
  if (raw === undefined) return { ok: false, why: "no answer" };
  switch (q.kind) {
    case "checkpoint": return { ok: cpOf(raw) === q.answer };
    case "text": return { ok: unwrap(raw) === q.answer };
    case "number": { const n = Number(unwrap(raw)); return { ok: Number.isFinite(n) && n === q.answer }; }
    case "ordered": { const got = list(raw); return { ok: got.length === q.answer.length && got.every((x, i) => x.toUpperCase() === q.answer[i]) }; }
    case "git-files": {
      const want = gitFiles(q.commit);
      if (want === null) return { ok: false, why: "no --git repo, cannot key" };
      if (!want.length) return { ok: false, why: `no ${q.commit} commit or it changed no src file` };
      const got = [...new Set(list(raw).map(path))].sort();
      return { ok: got.join(",") === want.join(","), why: `key ${want.join(",")}` };
    }
    default: throw new Error(`unknown kind ${q.kind}`);
  }
}

const key = JSON.parse(readFileSync(KEY, "utf8"));
const rows = [];
for (const p of key.probes) for (const q of p.questions) rows.push({ probe: p.id, id: q.id, given: given.get(q.id) ?? null, ...score(q, given.get(q.id)) });
const right = rows.filter((r) => r.ok).length;

if (JSON_OUT) console.log(JSON.stringify({ right, total: rows.length, rows }));
else {
  console.log(`${right}/${rows.length} probe answers right`);
  for (const r of rows) console.log(`  ${r.ok ? "right" : "wrong"}  ${r.id}  ${JSON.stringify(r.given)}${r.why && !r.ok ? `  (${r.why})` : ""}`);
}
