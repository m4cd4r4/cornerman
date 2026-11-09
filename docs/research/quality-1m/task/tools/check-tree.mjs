#!/usr/bin/env node
// Run checkpoint tests against a source tree, in a fresh copy, from outside the repo under test.
//   node check-tree.mjs --src <dir containing src/> --out <empty work dir> [--upto 8] [--only 3] [--kind visible|hidden|both] [--json]
// Prints one line per checkpoint: cpNN  visible pass/total  hidden pass/total.
// --out must not exist yet, or be empty: this tool never deletes anything.
import { cpSync, mkdirSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CPS = resolve(HERE, "..", "checkpoints");

function args(argv) {
  const a = { kind: "both", upto: Infinity, only: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--src") a.src = argv[++i];
    else if (k === "--out") a.out = argv[++i];
    else if (k === "--upto") a.upto = Number(argv[++i]);
    else if (k === "--only") a.only = Number(argv[++i]);
    else if (k === "--kind") a.kind = argv[++i];
    else if (k === "--json") a.json = true;
    else throw new Error(`unknown arg ${k}`);
  }
  if (!a.src || !a.out) throw new Error("need --src and --out");
  return a;
}

function runFile(cwd, rel) {
  const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", rel], { cwd, encoding: "utf8", timeout: 120000 });
  const out = (r.stdout || "") + (r.stderr || "");
  const pass = Number((/^# pass (\d+)/m.exec(out) || [])[1] || 0);
  const fail = Number((/^# fail (\d+)/m.exec(out) || [])[1] || 0);
  const failed = [...out.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1]);
  return { pass, total: pass + fail, failed, ran: r.status !== null, out };
}

const a = args(process.argv.slice(2));
if (existsSync(a.out) && readdirSync(a.out).length) throw new Error(`--out ${a.out} is not empty`);
mkdirSync(join(a.out, "test", "visible"), { recursive: true });
mkdirSync(join(a.out, "test", "hidden"), { recursive: true });
cpSync(join(a.src, "src"), join(a.out, "src"), { recursive: true });
writeFileSync(join(a.out, "package.json"), '{"type":"module"}\n');

const cps = readdirSync(CPS).filter((d) => /^cp\d\d$/.test(d)).sort()
  .filter((d) => (a.only ? Number(d.slice(2)) === a.only : Number(d.slice(2)) <= a.upto));
const rows = [];
for (const cp of cps) {
  const row = { cp };
  for (const kind of a.kind === "both" ? ["visible", "hidden"] : [a.kind]) {
    const from = join(CPS, cp, `${kind}.test.mjs`);
    if (!existsSync(from)) continue;
    const rel = join("test", kind, `${cp}.test.mjs`);
    cpSync(from, join(a.out, rel));
    row[kind] = runFile(a.out, rel);
  }
  rows.push(row);
}

if (a.json) {
  console.log(JSON.stringify(rows.map((r) => ({ cp: r.cp, visible: r.visible && { pass: r.visible.pass, total: r.visible.total, failed: r.visible.failed }, hidden: r.hidden && { pass: r.hidden.pass, total: r.hidden.total, failed: r.hidden.failed } }))));
} else {
  for (const r of rows) {
    const f = (x) => (x ? `${x.pass}/${x.total}` : "-");
    console.log(`${r.cp}  visible ${f(r.visible)}  hidden ${f(r.hidden)}`);
    for (const k of ["visible", "hidden"]) for (const name of r[k]?.failed || []) console.log(`    FAIL ${k}: ${name}`);
  }
}
const bad = rows.some((r) => ["visible", "hidden"].some((k) => r[k] && (r[k].failed.length || r[k].total === 0)));
process.exitCode = bad ? 1 : 0;
