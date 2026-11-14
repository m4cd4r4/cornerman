#!/usr/bin/env node
// dial-batch.mjs: the full fill dial (TASK-DESIGN.md "Fill dial"), 5 arms x n = 5, Sonnet, one
// run at a time. Each run: setup -> verify -> run -> park -> score (fork.mjs), the post-run steps
// as dial-finish.mjs does them. Then compare.mjs --fork, DIAL-RESULT.md, commit, push.
//   node dial-batch.mjs            run until every arm has N valid scored runs, or a stop rule hits
//   node dial-batch.mjs --plan     print what it would run next and the spend so far, no run
//
// Resume-safe: the state is read from I:/Scratch/_q1m-fork on every pass. A valid run = parked,
// score.json present, no out/INVALID, ended.txt says finished true. The pilot's natural r3 and
// fill900 r1 count.
// Order: round-robin across arms (one run per arm needing more per round, the arm order rotating
// each round), so a stop part-way leaves the arms balanced and no arm gets one time of day.
// Stop rules (each ends the batch with a line in batch.log and exit 2; nothing is retried blind):
//   - spend: before a run, real spend so far + that arm's estimate must stay within BUDGET
//     (Macdara's approval, 2026-11-13 ~18:15 AWST: about US$340 for the full dial).
//   - INVALID runs: more than MAX_INVALID in this batch.
//   - any step of fork.mjs fails other than park (park is retried, as in dial-finish.mjs).
// Usage limits and 403s are handled inside fork.mjs run (wait and resume the same session).
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const QDIR = resolve(HERE, "..", "..");
const REPO = resolve(QDIR, "..", "..", "..");
const PARK = "I:/Scratch/_q1m-fork", LIVE = "I:/Scratch/_q1m/default-sonnet-r3", LOCK = "I:/Scratch/_q1m/.lock";
const ARMS = ["natural", "fill700", "fill900", "compact", "clear"];
const N = 5;
// The cap is read before every run: _q1m-fork/budget.txt (a number) overrides it, so a raise
// Macdara approves applies without stopping a live run. Only ever raise it on his yes.
const budget = () => { const t = Number(read(join(PARK, "budget.txt")).trim()); return Number.isFinite(t) && t > 0 ? t : 340; };
// Per-run estimates (US$, real): natural and fill900 measured in the dial pilot; the rest from the
// design estimate scaled by natural's measured/estimated ratio (14.96 / 15), rounded up.
const EST = { natural: 15, fill700: 21, fill900: 26, compact: 11, clear: 12 };
const MAX_INVALID = 3;
const LOG = join(PARK, "batch.log");
const PLAN = process.argv.includes("--plan");

const say = (s) => { const l = `${new Date().toISOString()} ${s}`; console.log(l); if (!PLAN) appendFileSync(LOG, l + "\n"); };
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const fork = (...a) => spawnSync(process.execPath, [join(HERE, "fork.mjs"), ...a], { encoding: "utf8", maxBuffer: 1 << 26 });
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");

// Every parked fork of this model, with its state and real cost.
function state() {
  const runs = [];
  for (const name of existsSync(PARK) ? readdirSync(PARK) : []) {
    const m = /^fork-(natural|fill\d+|compact|clear)-sonnet-r(\d+)$/.exec(name);
    if (!m) continue;
    const P = join(PARK, name);
    const ended = read(join(P, "out", "ended.txt")).trim();
    const invalid = existsSync(join(P, "out", "INVALID"));
    const valid = !invalid && /finished true/.test(ended) && existsSync(join(P, "score.json"));
    // Real cost: ended.txt carries the per-session sum since the batch build. The pilot's two runs
    // predate it (their ended.txt summed cumulative totals), so their measured figures are used.
    const PILOT = { "fork-natural-sonnet-r2": 20.9, "fork-natural-sonnet-r3": 14.96, "fork-fill900-sonnet-r1": 25.8, "fork-natural-sonnet-r1": 0 };
    const cost = name in PILOT ? PILOT[name] : Number((/cost ([\d.]+)/.exec(ended) || [])[1] || 0);
    runs.push({ name, arm: m[1], r: Number(m[2]), valid, invalid, ended, cost, pilot: name in PILOT });
  }
  return runs;
}

function nextRun(runs) {
  const need = ARMS.filter((a) => runs.filter((x) => x.arm === a && x.valid).length < N);
  if (!need.length) return null;
  // Round = the fewest valid runs any needing arm has; rotate the arm order by that round.
  const count = (a) => runs.filter((x) => x.arm === a && x.valid).length;
  const round = Math.min(...need.map(count));
  const rot = ARMS.map((_, i) => ARMS[(i + round) % ARMS.length]).filter((a) => need.includes(a) && count(a) === round);
  const arm = rot[0];
  const r = Math.max(0, ...runs.filter((x) => x.arm === arm).map((x) => x.r)) + 1;
  return { arm, name: `fork-${arm}-sonnet-r${r}` };
}

async function parkWithRetry(name) {
  await sleep(30000); // let any handle on the live folder close
  for (let i = 0; i < 10; i++) {
    const r = fork("park", name);
    if (r.status === 0) { say(r.stdout.trim()); return true; }
    say(`park try ${i + 1} failed: ${(r.stderr || "").split("\n").find((l) => /Error/.test(l))}`);
    await sleep(30000);
  }
  return false;
}

function stop(why) { say(`STOP: ${why}`); process.exit(2); }

// --- main ---
const startRuns = state();
const spentBefore = startRuns.filter((x) => !x.pilot).reduce((s, x) => s + x.cost, 0);
let invalidThisBatch = 0;
if (PLAN) {
  const n = nextRun(startRuns);
  for (const a of ARMS) console.log(`${a}: ${startRuns.filter((x) => x.arm === a && x.valid).length}/${N} valid (${startRuns.filter((x) => x.arm === a).map((x) => `r${x.r}${x.valid ? "" : x.invalid ? " INVALID" : " unfinished"}`).join(", ")})`);
  console.log(`dial spend so far (excl. pilot): US$${spentBefore.toFixed(2)} of ${budget()}; next: ${n ? `${n.name} (est. US$${EST[n.arm]})` : "none, all arms complete"}`);
  process.exit(0);
}
say(`batch start: dial spend so far US$${spentBefore.toFixed(2)} of ${budget()}`);
for (;;) {
  const runs = state();
  const spent = runs.filter((x) => !x.pilot).reduce((s, x) => s + x.cost, 0);
  const n = nextRun(runs);
  if (!n) break;
  if (spent + EST[n.arm] > budget()) stop(`next run ${n.name} (est. US$${EST[n.arm]}) would take the dial past US$${budget()} (spent US$${spent.toFixed(2)}); needs a fresh yes`);
  if (existsSync(LIVE)) stop(`${LIVE} exists: a run is live or was not parked`);
  if (existsSync(LOCK)) stop(`${LOCK} exists`);
  say(`${n.name}: setup (spent US$${spent.toFixed(2)})`);
  for (const step of ["setup", "verify"]) {
    const r = fork(step, n.name);
    if (r.status !== 0) stop(`${n.name} ${step} exit ${r.status}: ${(r.stdout + r.stderr).trim().split("\n").slice(-6).join(" | ")}`);
    say(`${n.name} ${step}: ${r.stdout.trim().split("\n").at(-1)}`);
  }
  say(`${n.name}: run`);
  const r = spawnSync(process.execPath, [join(HERE, "fork.mjs"), "run", n.name], { stdio: ["ignore", "inherit", "inherit"] });
  const ended = read(join(LIVE, "out", "ended.txt")).trim();
  say(`${n.name}: run exit ${r.status}, ${ended || "no ended.txt"}`);
  if (!(await parkWithRetry(n.name))) stop(`could not park ${n.name}`);
  const P = join(PARK, n.name);
  if (existsSync(join(P, "out", "INVALID")) || !/finished true/.test(ended)) {
    invalidThisBatch++;
    say(`${n.name}: INVALID or unfinished, not scored (${read(join(P, "out", "INVALID")).trim() || ended}); ${invalidThisBatch} this batch`);
    if (!existsSync(join(P, "out", "INVALID"))) appendFileSync(join(P, "out", "INVALID"), `${new Date().toISOString()} unfinished: ${ended}\n`);
    if (invalidThisBatch > MAX_INVALID) stop(`${invalidThisBatch} INVALID runs this batch`);
    if (r.status !== 0) stop(`fork.mjs run exit ${r.status}`);
    continue;
  }
  const s = fork("score", n.name);
  if (s.status !== 0) stop(`${n.name} score exit ${s.status}: ${s.stderr.trim().split("\n").slice(-4).join(" | ")}`);
  const j = JSON.parse(readFileSync(join(P, "score.json"), "utf8"));
  say(`${n.name}: scored late ${j.summary.latePassed}/${j.summary.lateTotal}, chat ${j.summary.chat?.passed}/${j.summary.chat?.total}, compactions ${j.summary.tokens?.compactions}, peak ${j.summary.tokens?.peak}, cost ${j.harness?.cost}`);
}

// All arms complete: compare, write up, commit, push.
const md = join(QDIR, "DIAL-RESULT.md");
const c = spawnSync(process.execPath, [join(QDIR, "task", "tools", "compare.mjs"), "--fork", "--md", join(PARK, "compare-full.md")], { encoding: "utf8" });
say(`compare exit ${c.status}`);
const runs = state().filter((x) => x.valid).sort((a, b) => ARMS.indexOf(a.arm) - ARMS.indexOf(b.arm) || a.r - b.r);
const row = (x) => { const s = JSON.parse(readFileSync(join(PARK, x.name, "score.json"), "utf8")).summary; return `| ${x.name} | ${s.latePassed}/${s.lateTotal} | ${s.chat?.passed}/${s.chat?.total} | ${s.tokens?.compactions} | ${s.tokens?.peak} | ${s.regressions} | ${x.cost.toFixed(2)} |`; };
writeFileSync(md, [
  "# Fill dial, full run (generated by harness/dial-batch.mjs; not yet reviewed)", "",
  `Generated ${new Date().toISOString()}. 5 arms x n = ${N}, Sonnet, all forked from pilot 3 at cp44. Pilot 3 reference on cp44-80: 33/37, chat 12/14.`, "",
  "compare.mjs --fork:", "", c.stdout.trim(), "",
  "| Run | cp44-80 hidden | Chat | Compactions | Peak context | Regressions | Real cost US$ |", "|:--|--:|--:|--:|--:|--:|--:|", ...runs.map(row), "",
  `Dial spend (excl. pilot): US$${state().filter((x) => !x.pilot).reduce((s, x) => s + x.cost, 0).toFixed(2)}.`, "",
].join("\n"));
const git = (...a) => execFileSync("git", ["-C", REPO, ...a], { encoding: "utf8" });
git("add", md);
git("commit", "-q", "-m", "docs(quality-1m): full fill dial scored (5 arms x n=5)", "-m", "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>");
git("push", "-q", "origin", "research/quality-1m");
say(`DONE: committed and pushed ${md}`);
