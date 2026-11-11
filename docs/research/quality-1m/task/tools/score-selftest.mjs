#!/usr/bin/env node
// tdd-guard:allow - self-test of score-run.mjs and tokens.mjs.
// Builds runs with known answers from a reference smoke run and checks the scorer's verdicts.
//   node score-selftest.mjs --smoke <smoke-gate --work dir> --work <empty dir>
// Cases: known-good (N/N, no violations once commits exist); a broken run (cp16 mutant at its
// snapshot, eval at cp30, a cp06 break in the final tree, the last checkpoint never reached); a snapshot holding
// test/hidden is refused; a hand-made transcript gives the expected work-token timeline.
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { timeline, workAt, stateAt } from "./tokens.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const N = readdirSync(join(HERE, "..", "checkpoints")).filter((d) => /^cp\d\d$/.test(d)).length;
const cpName = (i) => `cp${String(i).padStart(2, "0")}`;
const LAST = cpName(N), PREV = cpName(N - 1);
function arg(n) { const i = process.argv.indexOf(n); return i === -1 ? null : process.argv[i + 1]; }
const SMOKE = arg("--smoke"), WORK = arg("--work");
if (!SMOKE || !WORK) throw new Error("need --smoke --work");
if (existsSync(WORK) && readdirSync(WORK).length) throw new Error("--work not empty");
mkdirSync(WORK, { recursive: true });

const fails = [];
const expect = (c, m) => { if (!c) fails.push(m); console.log(`${c ? "ok  " : "FAIL"} ${m}`); };
const git = (cwd, ...a) => spawnSync("git", a, { cwd, encoding: "utf8" });

function makeRun(name) {
  const root = join(WORK, name);
  cpSync(join(SMOKE, "run"), join(root, "run"), { recursive: true });
  cpSync(join(SMOKE, "repo"), join(root, "repo"), { recursive: true });
  const repo = join(root, "repo");
  for (let i = 1; i <= N; i++) git(repo, "-c", "user.email=t@local", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", `cp${String(i).padStart(2, "0")}: step ${i}`);
  return root;
}
function score(root, extra = []) {
  const json = join(root, "score.json");
  const r = spawnSync(process.execPath, [join(HERE, "score-run.mjs"), "--run", join(root, "run"), "--repo", join(root, "repo"), "--out", join(root, "out"), "--json", json, ...extra], { encoding: "utf8", maxBuffer: 1 << 26 });
  return { r, j: existsSync(json) ? JSON.parse(readFileSync(json, "utf8")) : null };
}
function edit(file, find, replace) {
  const t = readFileSync(file, "utf8");
  if (!t.includes(find)) throw new Error(`find text missing in ${file}`);
  writeFileSync(file, t.replace(find, replace));
}

// 1. Known-good.
{
  const root = makeRun("good");
  const { j } = score(root, ["--k", "20"]);
  const s = j?.summary;
  expect(s && s.reached === N && s.passed === N, `good: ${N}/${N} passed (got ${s?.passed})`);
  expect(s && s.latePassed === N - 19 && s.lateTotal === N - 19, `good: late segment cp20-${LAST} is ${N - 19}/${N - 19}`);
  expect(s && s.regressions === 0, "good: no regressions");
  expect(s && s.ruleViolations === 0 && s.ruleViolationsDistinct === 0, `good: no rule violations (got ${s?.ruleViolations})`);
}

// 2. Broken run.
{
  const root = makeRun("broken");
  const snaps = join(root, "run", "snapshots");
  edit(join(snaps, "cp16-done", "src", "functions.mjs"), "  const digits = Math.trunc(d);", "  const digits = Math.round(d);");
  appendFileSync(join(snaps, "cp30-done", "src", "functions.mjs"), "\nexport const sneaky = eval(\"1\");\n");
  edit(join(snaps, `${PREV}-done`, "src", "evaluate.mjs"), "    const x = a.toLowerCase();\n    const y = b.toLowerCase();", "    const x = a;\n    const y = b;");
  rmSync(join(snaps, `${LAST}-done`), { recursive: true });
  const { j } = score(root);
  const row = (cp) => j?.rows.find((r) => r.cp === cp);
  expect(j?.summary.reached === N - 1, `broken: ${N - 1} reached (got ${j?.summary.reached})`);
  expect(row("cp16") && !row("cp16").pass, "broken: cp16 mutant fails its checkpoint");
  expect(row("cp15")?.pass && row("cp17")?.pass, "broken: neighbours of cp16 still pass");
  expect(row(LAST) && !row(LAST).reached && !row(LAST).pass, `broken: ${LAST} not reached, scored fail`);
  expect(row("cp30")?.rules?.some((v) => v.rule === 1), "broken: eval at cp30 is a rule 1 violation");
  expect(!row("cp29")?.rules?.length, "broken: cp29 has no violations");
  expect(j?.summary.ruleViolations === 1 && j?.summary.ruleViolationsDistinct === 1, `broken: one violation, one distinct (got ${j?.summary.ruleViolations}, ${j?.summary.ruleViolationsDistinct})`);
  expect(j?.regress.some((g) => g.cp === "cp06"), `broken: cp06 regression found in the final tree (got ${j?.regress.map((g) => g.cp).join(",")})`);
  expect(!j?.regress.some((g) => g.cp === "cp16"), "broken: cp16 is not a regression (it never passed)");
}

// 3. A snapshot with test/hidden is refused.
{
  const root = join(WORK, "leak");
  cpSync(join(SMOKE, "run"), join(root, "run"), { recursive: true });
  mkdirSync(join(root, "repo"));
  mkdirSync(join(root, "run", "snapshots", "cp05-done", "test", "hidden"), { recursive: true });
  const { r } = score(root);
  expect(r.status !== 0 && /refused/.test(r.stderr), "leak: snapshot holding test/hidden refused");
}

// 4. Tokens: session A 100, 200, (compact) 150, 300; session B 50, 80. Sidechain ignored.
{
  const dir = join(WORK, "transcripts", "proj");
  mkdirSync(dir, { recursive: true });
  const t0 = Date.parse("2026-01-01T00:00:00Z");
  const msg = (s, i, ctx, extra = {}) => JSON.stringify({ type: "assistant", sessionId: s, timestamp: new Date(t0 + i * 1000).toISOString(), message: { id: `${s}${i}`, usage: { input_tokens: 10, cache_read_input_tokens: ctx - 10, cache_creation_input_tokens: 0, output_tokens: 5 } }, ...extra });
  writeFileSync(join(dir, "a.jsonl"), [msg("a", 1, 100), msg("a", 1, 100), msg("a", 2, 200),
    JSON.stringify({ type: "system", subtype: "compact_boundary", sessionId: "a", timestamp: new Date(t0 + 2500).toISOString() }),
    msg("a", 3, 150), msg("a", 4, 300), msg("a", 5, 9999, { isSidechain: true })].join("\n") + "\n");
  writeFileSync(join(dir, "b.jsonl"), [msg("b", 6, 50), msg("b", 7, 80)].join("\n") + "\n");
  const tl = timeline(join(WORK, "transcripts"));
  expect(tl.work === 430, `tokens: work 430 (got ${tl.work})`);
  expect(tl.peak === 300 && tl.sessions === 2 && tl.compactions === 1, `tokens: peak 300, 2 sessions, 1 compaction (got ${tl.peak}, ${tl.sessions}, ${tl.compactions})`);
  expect(workAt(tl, t0 + 3500) === 200 && workAt(tl, t0 + 4000) === 350, "tokens: workAt by time");
  const same = (got, want) => JSON.stringify(got) === JSON.stringify(want);
  expect(stateAt(tl, t0) === null, "tokens: stateAt before the first message is null");
  expect(same(stateAt(tl, t0 + 2000), { ctx: 200, resetKind: "none", resets: 0, workSinceReset: 200, msSinceReset: 1000 }), `tokens: stateAt before any reset (got ${JSON.stringify(stateAt(tl, t0 + 2000))})`);
  expect(same(stateAt(tl, t0 + 4000), { ctx: 300, resetKind: "compacted", resets: 1, workSinceReset: 150, msSinceReset: 1000 }), `tokens: stateAt after a compaction (got ${JSON.stringify(stateAt(tl, t0 + 4000))})`);
  expect(same(stateAt(tl, t0 + 7500), { ctx: 80, resetKind: "new-session", resets: 2, workSinceReset: 80, msSinceReset: 1500 }), `tokens: stateAt in a new session (got ${JSON.stringify(stateAt(tl, t0 + 7500))})`);
}

console.log(fails.length ? `SCORE SELFTEST FAIL (${fails.length})` : "SCORE SELFTEST OK");
process.exitCode = fails.length ? 1 : 0;
