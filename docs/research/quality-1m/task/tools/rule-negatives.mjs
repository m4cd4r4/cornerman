#!/usr/bin/env node
// tdd-guard:allow - research fixture self-test, not app code.
// House-rule checker self-test: each case is the clean reference tree with one change.
// check-rules.mjs must report exactly the expected rules (an empty list = no violations).
//   node rule-negatives.mjs --work <empty dir>
// Exit 0 only if every case matched. Rule 5 (git history) is covered by the gate smoke run.
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync, appendFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK = resolve(HERE, "..");
const REF = join(TASK, "reference");
const CPS = join(TASK, "checkpoints");
const CHECK = join(HERE, "check-rules.mjs");

const work = process.argv[process.argv.indexOf("--work") + 1];
if (!work || process.argv.indexOf("--work") === -1) throw new Error("need --work <empty dir>");
if (existsSync(work) && readdirSync(work).length) throw new Error(`--work ${work} is not empty`);

const cps = readdirSync(CPS).filter((n) => /^cp\d\d$/.test(n)).sort();
const UPTO = Number(cps[cps.length - 1].slice(2));
const visibleHashes = {};
for (const cp of cps) visibleHashes[cp] = createHash("sha256").update(readFileSync(join(CPS, cp, "visible.test.mjs"), "utf8")).digest("hex");
mkdirSync(work, { recursive: true });
const STATE = join(work, "gate-state.json");
writeFileSync(STATE, JSON.stringify({ current: cps.length, visibleHashes }));

const edit = (find, replace) => (f) => {
  const t = readFileSync(f, "utf8");
  if (!t.includes(find)) throw new Error(`find text missing in ${f}`);
  writeFileSync(f, t.replace(find, replace));
};
const pad = (total) => (f) => {
  const t = readFileSync(f, "utf8").replace(/\n?$/, "\n");
  const have = t.split("\n").length - 1;
  writeFileSync(f, t + "// filler\n".repeat(Math.max(0, total - have)));
};

// [name, relative file, change, expected rules]
const CASES = [
  ["clean", null, null, []],
  ["eval-call", "src/evaluate.mjs", (f) => { const [h, ...rest] = readFileSync(f, "utf8").split("\n"); writeFileSync(f, [h, "export const shortcut = (s) => eval(s);", ...rest].join("\n")); }, [1]],
  ["new-function", "src/parser.mjs", (f) => appendFileSync(f, "export const compile = (s) => new Function(\"return \" + s);\n"), [1]],
  ["vm-import", "src/lexer.mjs", (f) => appendFileSync(f, "import vm from \"node:vm\";\n"), [1]],
  ["indirect-eval", "src/index.mjs", (f) => appendFileSync(f, "export const g = globalThis[\"eval\"];\n"), [1]],
  ["eval-in-comment-only", "src/display.mjs", (f) => appendFileSync(f, "// never call eval(x) here; new Function is banned too\n"), []],
  ["evaluate-identifier", "src/errors.mjs", (f) => appendFileSync(f, "export const evaluateLater = (x) => x.evaluate(1);\n"), []],
  ["method-named-eval", "src/errors.mjs", (f) => appendFileSync(f, "export const viaEnv = (env, node) => env.eval(node);\n"), []],
  ["global-dot-eval", "src/errors.mjs", (f) => appendFileSync(f, "export const sneak = (s) => globalThis.eval(s);\n"), [1]],
  ["299-lines", "src/address.mjs", pad(299), []],
  ["300-lines", "src/address.mjs", pad(300), [2]],
  ["missing-header", "src/lexer.mjs", edit("// lexer.mjs: tokens for formulas", "// tokens for formulas"), [3]],
  ["wrong-file-in-header", "src/display.mjs", edit("// display.mjs: display text", "// format.mjs: display text"), [3]],
  ["blank-first-line", "src/errors.mjs", (f) => writeFileSync(f, "\n" + readFileSync(f, "utf8")), [3]],
  ["new-file-no-header", "src/extra.mjs", (f) => writeFileSync(f, "export const x = 1;\n"), [3]],
  ["visible-test-edited", "test/visible/cp03.test.mjs", (f) => appendFileSync(f, "\n// tweak\n"), [4]],
  ["visible-test-deleted", "test/visible/cp05.test.mjs", (f) => rmSync(f), [4]],
  ["own-test-added", "test/mine/extra.test.mjs", (f) => { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, "// mine\n"); }, []],
];

let ok = true;
for (const [name, rel, change, want] of CASES) {
  const dir = join(work, name);
  cpSync(join(REF, "src"), join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "test", "visible"), { recursive: true });
  for (const cp of cps) cpSync(join(CPS, cp, "visible.test.mjs"), join(dir, "test", "visible", `${cp}.test.mjs`));
  if (change) change(join(dir, rel));
  const r = spawnSync(process.execPath, [CHECK, "--tree", dir, "--state", STATE, "--upto", String(UPTO), "--json"], { encoding: "utf8" });
  let got;
  try { got = JSON.parse(r.stdout.trim().split("\n").pop()).violations; } catch { console.log(`ERROR    ${name}: ${r.stderr.trim().split("\n")[0]}`); ok = false; continue; }
  const rules = [...new Set(got.map((v) => v.rule))].sort();
  const pass = rules.join(",") === want.join(",") && (want.length === 0) === (r.status === 0);
  if (!pass) ok = false;
  console.log(`${pass ? "OK      " : "MISMATCH"} ${name.padEnd(22)} want [${want}] got [${rules}]${pass ? "" : "  " + JSON.stringify(got)}`);
}
process.exitCode = ok ? 0 : 1;
