#!/usr/bin/env node
// Scorer self-test: each mutant is the reference with one plausible mistake. Its target
// checkpoint's hidden tests must fail; the report also lists collateral failures.
//   node mutants.mjs --work <empty dir>
// Exit 0 only if every mutant applied cleanly AND failed its target.
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REF = resolve(HERE, "..", "reference");
const CHECK = join(HERE, "check-tree.mjs");

const MUTANTS = [
  { name: "excel-number-grammar", file: "index.mjs", find: "if (NUMBER.test(raw)) {", replace: "if (raw.trim() !== \"\" && !Number.isNaN(Number(raw))) {", target: "cp01" },
  { name: "unary-above-power", file: "parser.mjs", find: "      return { k: \"neg\", op, arg: unary() };", replace: "      const arg = postfix();\n      const neg = { k: \"neg\", op, arg };\n      if (isOp(\"^\")) { take(); return { k: \"bin\", op: \"^\", left: neg, right: unary() }; }\n      return neg;", target: "cp02" },
  { name: "blank-ref-is-null", file: "index.mjs", find: "const out = v === null ? 0 :", replace: "const out = v === null ? null :", target: "cp03" },
  { name: "leftmost-error-wins", file: "errors.mjs", find: "    if (best === null) { best = e; continue; }", replace: "    if (best === null) { best = e; continue; }\n    continue;", target: "cp04" },
  { name: "round-half-up", file: "display.mjs", find: "      up = Number(last) % 2 === 1;", replace: "      up = true;", target: "cp05" },
  { name: "case-sensitive-text", file: "evaluate.mjs", find: "    const x = a.toLowerCase();\n    const y = b.toLowerCase();", replace: "    const x = a;\n    const y = b;", target: "cp06" },
  { name: "percent-below-power", file: "parser.mjs", find: "    if (isOp(\"^\")) { take(); return { k: \"bin\", op: \"^\", left: base, right: unary() }; }\n    return base;", replace: "    if (isOp(\"^\")) { take(); const r = { k: \"bin\", op: \"^\", left: base.k === \"pct\" ? base.arg : base, right: unary() }; return base.k === \"pct\" ? { k: \"pct\", arg: r } : r; }\n    return base;", target: "cp07" },
  { name: "no-tolerance", file: "evaluate.mjs", find: "  return Math.abs(a - b) <= TOL * Math.max(1, Math.abs(a), Math.abs(b));", replace: "  return a === b;", target: "cp08" },
];

const work = process.argv[process.argv.indexOf("--work") + 1];
if (!work || process.argv.indexOf("--work") === -1) throw new Error("need --work <empty dir>");
if (existsSync(work) && readdirSync(work).length) throw new Error(`--work ${work} is not empty`);

let ok = true;
for (const m of MUTANTS) {
  const dir = join(work, m.name);
  mkdirSync(dir, { recursive: true });
  cpSync(join(REF, "src"), join(dir, "src"), { recursive: true });
  const f = join(dir, "src", m.file);
  let text = readFileSync(f, "utf8");
  const edits = m.edits || [[m.find, m.replace]];
  const missing = edits.filter(([find]) => !text.includes(find));
  if (missing.length) { console.log(`${m.name}: DID NOT APPLY (find text missing)`); ok = false; continue; }
  for (const [find, replace] of edits) text = text.replace(find, replace);
  writeFileSync(f, text);
  const r = spawnSync(process.execPath, [CHECK, "--src", dir, "--out", join(work, `${m.name}-run`), "--kind", "hidden", "--json"], { encoding: "utf8" });
  const rows = JSON.parse(r.stdout.trim().split("\n").pop());
  const failing = rows.filter((x) => x.hidden && (x.hidden.failed.length || x.hidden.total === 0)).map((x) => x.cp);
  const hit = failing.includes(m.target);
  if (!hit) ok = false;
  const collateral = failing.filter((c) => c !== m.target);
  console.log(`${hit ? "KILLED " : "SURVIVED"} ${m.name.padEnd(22)} target ${m.target}${collateral.length ? `  also fails ${collateral.join(" ")}` : ""}`);
}
process.exitCode = ok ? 0 : 1;
