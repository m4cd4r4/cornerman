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
  { name: "round-half-up", file: "decimal.mjs", find: "  return Number(lastKept) % 2 === 1;", replace: "  return true;", target: "cp05" },
  { name: "case-sensitive-text", file: "evaluate.mjs", find: "    const x = a.toLowerCase();\n    const y = b.toLowerCase();", replace: "    const x = a;\n    const y = b;", target: "cp06" },
  { name: "percent-below-power", file: "parser.mjs", find: "    if (isOp(\"^\")) { take(); return { k: \"bin\", op: \"^\", left: base, right: unary() }; }\n    return base;", replace: "    if (isOp(\"^\")) { take(); const r = { k: \"bin\", op: \"^\", left: base.k === \"pct\" ? base.arg : base, right: unary() }; return base.k === \"pct\" ? { k: \"pct\", arg: r } : r; }\n    return base;", target: "cp07" },
  { name: "no-tolerance", file: "evaluate.mjs", find: "  return Math.abs(a - b) <= TOL * Math.max(1, Math.abs(a), Math.abs(b));", replace: "  return a === b;", target: "cp08" },
  // Block B. Excel-prior mutants first in each checkpoint, then plausible implementation slips.
  { name: "cycle-is-zero", file: "index.mjs", find: "else if (cycleSet().has(k)) v = makeError(\"#CYCLE!\", k, \"circular reference\");", replace: "else if (cycleSet().has(k)) v = 0;", target: "cp09" },
  { name: "cycle-below-ref", file: "errors.mjs", find: "[\"#CYCLE!\", \"#REF!\",", replace: "[\"#REF!\", \"#CYCLE!\",", target: "cp09" },
  { name: "precedents-skip-empty", file: "index.mjs", find: "      return sorted(opts.transitive ? reachable(k, edgesOf) : edgesOf(k));", replace: "      return sorted(opts.transitive ? reachable(k, edgesOf) : edgesOf(k).filter((x) => inputs.has(x)));", target: "cp10" },
  { name: "transitive-has-self", file: "index.mjs", find: "      return sorted(opts.transitive ? reachable(k, edgesOf) : edgesOf(k));", replace: "      return sorted(opts.transitive ? new Set([k, ...reachable(k, edgesOf)]) : edgesOf(k));", target: "cp10" },
  { name: "set-clears-all", file: "index.mjs", find: "      relink(k);\n      invalidate([k]);", replace: "      relink(k);\n      cache.clear();", target: "cp11" },
  { name: "same-input-marks", file: "index.mjs", find: "      if ((inputs.get(k) ?? \"\") === input) return;\n", replace: "", target: "cp11" },
  { name: "dfs-order", file: "index.mjs", find: "      const order = recalcOrder(dirty, edgesOf);", replace: "      const order = [];\n      const seen = new Set();\n      const visit = (k) => { if (seen.has(k) || !dirty.includes(k)) return; seen.add(k); for (const p of edgesOf(k)) visit(p); order.push(k); };\n      dirty.forEach(visit);", target: "cp12" },
  { name: "no-resort", file: "graph.mjs", find: "    ready.sort((x, y) => compareAddresses(comps[x][0], comps[y][0]));\n", replace: "", target: "cp12" },
  { name: "text-coerced", file: "functions.mjs", find: "    else if (!count) errors.push(makeError(\"#VALUE!\", ctx.cell, \"text argument\"));", replace: "    else if (!count) { const n = Number(v); if (v.trim() !== \"\" && !Number.isNaN(n)) nums.push(n); else errors.push(makeError(\"#VALUE!\", ctx.cell, \"text argument\")); }", target: "cp13" },
  { name: "single-ref-direct", file: "functions.mjs", find: "const isRangeArg = (n) => n.k === \"ref\" || ", replace: "const isRangeArg = (n) => ", target: "cp13" },
  { name: "range-reads-first", file: "evaluate.mjs", find: "return isError(r) ? r : makeError(\"#VALUE!\", ctx.cell, \"range used outside a function\");", replace: "return isError(r) ? r : ctx.read(r[0]);", target: "cp13" },
  { name: "names-case-sensitive", file: "parser.mjs", find: "    if (NAME.test(w)) return { k: \"name\", v: up };", replace: "    if (NAME.test(w)) return { k: \"name\", v: w };", target: "cp14" },
  { name: "name-digits-allowed", file: "names.mjs", find: " && !/^[A-Za-z]+\\d+$/.test(name)", replace: "", target: "cp14" },
  { name: "one-cell-range-is-cell", file: "evaluate.mjs", find: "      if (n.range) return makeError(", replace: "      if (n.range && n.a !== n.b) return makeError(", target: "cp14" },
  { name: "minmax-empty-zero", file: "functions.mjs", find: "      if (!nums.length) return makeError(\"#VALUE!\", ctx.cell, `${fn} of no numbers`);", replace: "      if (!nums.length) return 0;", target: "cp15" },
  { name: "count-booleans", file: "functions.mjs", find: "    else if (typeof v === \"boolean\") { if (!count) nums.push(v ? 1 : 0); }", replace: "    else if (typeof v === \"boolean\") nums.push(v ? 1 : 0);", target: "cp15" },
  { name: "round-binary", file: "functions.mjs", find: "  return roundDecimal(x, digits === 0 ? 0 : digits, MODES[fn]);", replace: "  const f = Math.pow(10, digits);\n  const y = x * f;\n  const m = MODES[fn];\n  const r = m === \"down\" ? Math.trunc(y) : m === \"up\" ? (y < 0 ? Math.floor(y) : Math.ceil(y)) : Math.round(y);\n  return r / f || 0;", target: "cp16" },
  { name: "digits-rounded", file: "functions.mjs", find: "  const digits = Math.trunc(d);", replace: "  const digits = Math.round(d);", target: "cp16" },
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
