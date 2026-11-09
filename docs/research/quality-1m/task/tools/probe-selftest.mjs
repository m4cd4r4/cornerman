#!/usr/bin/env node
// tdd-guard:allow - research fixture self-test, not app code.
// Probe-checker self-test: a scratch git repo with a cp08 commit, then three answer files.
// right.md (varied formatting) must score every question right, wrong.md every question wrong,
// and an absent PROBES.md must score zero.
//   node probe-selftest.mjs --work <empty dir>
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECK = join(HERE, "check-probes.mjs");
const work = process.argv[process.argv.indexOf("--work") + 1];
if (!work || process.argv.indexOf("--work") === -1) throw new Error("need --work <empty dir>");
if (existsSync(work) && readdirSync(work).length) throw new Error(`--work ${work} is not empty`);

const repo = join(work, "repo");
mkdirSync(join(repo, "src"), { recursive: true });
const git = (...a) => { const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...a], { cwd: repo, encoding: "utf8" }); if (r.status) throw new Error(r.stderr); };
git("init", "-q");
writeFileSync(join(repo, "src", "a.mjs"), "// a.mjs: a\n"); git("add", "."); git("commit", "-q", "-m", "cp07: literals");
writeFileSync(join(repo, "src", "a.mjs"), "// a.mjs: a v2\n");
writeFileSync(join(repo, "src", "stats.mjs"), "// stats.mjs: counter\n");
writeFileSync(join(repo, "NOTES.md"), "x\n");
git("add", "."); git("commit", "-q", "-m", "cp08: tolerance and counter");
writeFileSync(join(repo, "src", "b.mjs"), "// b.mjs: b\n"); git("add", "."); git("commit", "-q", "-m", "cp09: cycles");

const files = {
  "right.md": "## Probe 1\nP1.1: cp04\n- **P1.2**: `#REF!`, #NAME?, #VALUE!, #DIV/0!\nP1.3: 0.000000001\nP1.4: `##########`\np1.5 = checkpoint 8\nP1.6: ./src/stats.mjs, src\\a.mjs\n",
  "wrong.md": "P1.1: cp02\nP1.2: #NAME?, #REF!, #VALUE!, #DIV/0!\nP1.3: 1e-6\nP1.4: #########\nP1.5: cp11\nP1.6: src/a.mjs\n",
};
for (const [n, t] of Object.entries(files)) writeFileSync(join(work, n), t);

const cases = [["right.md", "all"], ["wrong.md", 0], ["absent.md", 0]];
let ok = true;
for (const [n, want] of cases) {
  const r = spawnSync(process.execPath, [CHECK, "--answers", join(work, n), "--git", repo, "--json"], { encoding: "utf8" });
  if (r.status) { console.log(`ERROR    ${n}: ${r.stderr.trim()}`); ok = false; continue; }
  const { right, total, rows } = JSON.parse(r.stdout);
  const pass = total > 0 && right === (want === "all" ? total : want);
  if (!pass) ok = false;
  console.log(`${pass ? "OK      " : "MISMATCH"} ${n.padEnd(10)} ${right}/${total}${pass ? "" : "  " + JSON.stringify(rows.filter((x) => (want === "all") !== x.ok))}`);
}
process.exitCode = ok ? 0 : 1;
