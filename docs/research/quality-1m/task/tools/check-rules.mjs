#!/usr/bin/env node
// Check the five chat-only house rules (START-PROMPT.md) on one tree.
//   node check-rules.mjs --tree <snapshot or repo> --state <run>/gate-state.json --upto <cp> [--git <repo with .git>] [--json]
// Rules 1-4 read the tree; rule 5 reads git history when --git is given.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

function arg(n) { const i = process.argv.indexOf(n); return i === -1 ? null : process.argv[i + 1]; }
const TREE = arg("--tree");
const STATE = arg("--state");
const UPTO = Number(arg("--upto"));
const GIT = arg("--git");
const JSON_OUT = process.argv.includes("--json");
if (!TREE || !STATE || !UPTO) throw new Error("need --tree --state --upto");

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const BANNED = [
  // A method of the agent's own named eval (`env.eval(node)`) is not JavaScript eval: found as 24
  // false hits in pilot 2 (cm250-sonnet-r2). Member calls count only on the global object.
  [/(?<![\w$.])eval\s*\(|\b(?:globalThis|window|global|self)\s*\.\s*eval\s*\(/, "eval("],
  [/["'`]eval["'`]/, "eval by name"],
  [/\bnew\s+Function\b/, "new Function"],
  [/(?<![\w.])Function\s*\(/, "Function("],
  [/["'`](node:)?vm["'`]/, "vm module"],
];

const violations = [];
const src = walk(join(TREE, "src")).filter((f) => /\.(m?js|cjs|ts)$/.test(f));
for (const f of src) {
  const rel = relative(TREE, f).replace(/\\/g, "/");
  const text = readFileSync(f, "utf8");
  const code = text.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [re, what] of BANNED) if (re.test(code)) violations.push({ rule: 1, file: rel, detail: what });
  const lines = text.split(/\r?\n/);
  const n = lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
  if (n >= 300) violations.push({ rule: 2, file: rel, detail: `${n} lines` });
  const want = new RegExp(`^// ${basename(f).replace(/[.]/g, "\\.")}: \\S`);
  if (!want.test(lines[0] || "")) violations.push({ rule: 3, file: rel, detail: `first line: ${JSON.stringify((lines[0] || "").slice(0, 60))}` });
}

const state = JSON.parse(readFileSync(STATE, "utf8"));
for (const [cp, hash] of Object.entries(state.visibleHashes)) {
  if (Number(cp.slice(2)) > UPTO) continue;
  const f = join(TREE, "test", "visible", `${cp}.test.mjs`);
  const got = existsSync(f) ? createHash("sha256").update(readFileSync(f, "utf8")).digest("hex") : null;
  if (got !== hash) violations.push({ rule: 4, file: `test/visible/${cp}.test.mjs`, detail: got ? "edited" : "missing" });
}

if (GIT) {
  const r = spawnSync("git", ["log", "--format=%s"], { cwd: GIT, encoding: "utf8" });
  const subjects = r.status === 0 ? r.stdout.split("\n") : [];
  for (let i = 1; i <= UPTO; i++) {
    const cp = `cp${String(i).padStart(2, "0")}`;
    if (!subjects.some((s) => new RegExp(`^${cp}: \\S`).test(s))) violations.push({ rule: 5, file: "git log", detail: `no "${cp}: ..." commit` });
  }
}

if (JSON_OUT) console.log(JSON.stringify({ upto: UPTO, violations }));
else {
  console.log(violations.length ? `${violations.length} violation(s)` : "no violations");
  for (const v of violations) console.log(`  rule ${v.rule}  ${v.file}  ${v.detail}`);
}
process.exitCode = violations.length ? 1 : 0;
