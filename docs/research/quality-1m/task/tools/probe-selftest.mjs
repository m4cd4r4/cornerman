#!/usr/bin/env node
// tdd-guard:allow - research fixture self-test, not app code.
// Probe-checker self-test: a scratch git repo with cp05-cp47 commits, then three answer files.
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
writeFileSync(join(repo, "src", "display.mjs"), "// display.mjs: text\n");
writeFileSync(join(repo, "src", "decimal.mjs"), "// decimal.mjs: rounding\n");
writeFileSync(join(repo, "README.md"), "x\n");
git("add", "."); git("commit", "-q", "-m", "cp05: display text");
writeFileSync(join(repo, "src", "a.mjs"), "// a.mjs: a\n"); git("add", "."); git("commit", "-q", "-m", "cp07: literals");
writeFileSync(join(repo, "src", "a.mjs"), "// a.mjs: a v2\n");
writeFileSync(join(repo, "src", "stats.mjs"), "// stats.mjs: counter\n");
writeFileSync(join(repo, "NOTES.md"), "x\n");
git("add", "."); git("commit", "-q", "-m", "cp08: tolerance and counter");
writeFileSync(join(repo, "src", "b.mjs"), "// b.mjs: b\n"); git("add", "."); git("commit", "-q", "-m", "cp09: cycles");
writeFileSync(join(repo, "src", "structure.mjs"), "// structure.mjs: rows\n");
writeFileSync(join(repo, "src", "b.mjs"), "// b.mjs: b v2\n");
git("add", "."); git("commit", "-q", "-m", "cp23: insert rows");
writeFileSync(join(repo, "src", "workbook.mjs"), "// workbook.mjs: sheets\n");
writeFileSync(join(repo, "src", "a.mjs"), "// a.mjs: a v3\n");
writeFileSync(join(repo, "README.md"), "x\n");
git("add", "."); git("commit", "-q", "-m", "cp31: workbooks and sheet references");
writeFileSync(join(repo, "src", "merges.mjs"), "// merges.mjs: merged ranges\n");
writeFileSync(join(repo, "src", "layers.mjs"), "// layers.mjs: layers\n");
writeFileSync(join(repo, "NOTES.md"), "y\n");
git("add", "."); git("commit", "-q", "-m", "cp47: merged ranges");

const files = {
  "right.md": "## Probe 1\nP1.1: cp2\n- **P1.2**: `#REF!`, #NAME?, #VALUE!, #DIV/0!\nP1.3: 0.000000001\nP1.4: `##########`\np1.5 = checkpoint 13\nP1.6: ./src/stats.mjs, src\\a.mjs\nP1.7: #CYCLE!\nP1.8: 10,000\nP1.9: B1, C1, A1\nP1.10: `TAX2024`\n## Probe 2\nP2.1: Checkpoint 23\nP2.2: 61\n- **P2.3**: `#REF!`\nP2.4: \"FALSE\"\nP2.5: src/structure.mjs; src/b.mjs\nP2.6: 2,921,940\nP2.7: #CYCLE!\nP2.8: cp1\nP2.9: #CYCLE!, #REF!, #NAME?, #N/A, #VALUE!, #DIV/0!\nP2.10: `=SUM(A1:D1)`\n## Probe 3\nP3.1: checkpoint 23\nP3.2: `Sheet_1`\n- **P3.3**: #DIV/0!\nP3.4: \"sheets.1.cells.a1\"\nP3.5: src/workbook.mjs, ./src/a.mjs\nP3.6: CP33\nP3.7: `#ADDR`\nP3.8: 2\nP3.9: 2\nP3.10: B2\n## Probe 4\nP4.1: checkpoint 1\n- **P4.2**: C1, A2, Zeta!A1; zeta!B2, Alpha!A1\nP4.3: `100`\np4.4 = 367\nP4.5: \"0.666667\"\nP4.6: `#VALUE!`\nP4.7: 1\nP4.8: `=C3+$C$1+E$1`\nP4.9: src/display.mjs, ./src/decimal.mjs\nP4.10: CP23\n## Probe 5\nP5.1: Checkpoint 2\n- **P5.2**: 1; 2; 4; 5; 9\nP5.3: `200`\np5.4 = \"58%\"\nP5.5: 2\nP5.6: CP21\nP5.7: `#VALUE!`\nP5.8: `=#REF!*2`\nP5.9: src/layers.mjs, ./src/merges.mjs\nP5.10: checkpoint 46\n",
  "wrong.md": "P1.1: cp04\nP1.2: #NAME?, #REF!, #VALUE!, #DIV/0!\nP1.3: 1e-6\nP1.4: #########\nP1.5: cp14\nP1.6: src/a.mjs\nP1.7: #REF!\nP1.8: 1000\nP1.9: C1, B1, A1\nP1.10: T2X\nP2.1: cp24\nP2.2: 36586\nP2.3: #VALUE!\nP2.4: false\nP2.5: src/structure.mjs\nP2.6: 2958465\nP2.7: 0\nP2.8: cp02\nP2.9: #CYCLE!, #REF!, #N/A, #NAME?, #VALUE!, #DIV/0!\nP2.10: =SUM(A1:C1)\nP3.1: cp34\nP3.2: SHEET_1\nP3.3: #NAME?\nP3.4: sheets.1.a1\nP3.5: src/workbook.mjs\nP3.6: cp30\nP3.7: #LOAD\nP3.8: 3\nP3.9: 1\nP3.10: A1\nP4.1: cp02\nP4.2: C1, A2, Alpha!A1, Zeta!A1, Zeta!B2\nP4.3: 99\nP4.4: 366\nP4.5: 0.67\nP4.6: #REF!\nP4.7: 2\nP4.8: =C3+$C$1+D$1\nP4.9: src/display.mjs\nP4.10: cp24\nP5.1: cp03\nP5.2: 1, 2, 3, 4, 5, 9\nP5.3: 255\nP5.4: 57%\nP5.5: 3\nP5.6: cp20\nP5.7: #DIV/0!\nP5.8: =Data!#REF!*2\nP5.9: src/merges.mjs\nP5.10: cp47\n",
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
