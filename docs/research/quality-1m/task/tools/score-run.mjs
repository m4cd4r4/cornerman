#!/usr/bin/env node
// tdd-guard:allow - research scorer, proven by tools/score-selftest.mjs.
// Score one run: per-checkpoint hidden tests on the scored snapshot, regressions on the final
// tree, house rules per snapshot, recall probes, and work tokens at each checkpoint's request.
//   node score-run.mjs --run <run dir> --repo <agent repo, with .git> --out <empty dir>
//     [--transcripts <CLAUDE_CONFIG_DIR>/projects] [--k <first late checkpoint>] [--json <file>]
// The scored snapshot for cpNN is snapshots/cpNN-done, the first tree that passed its visible
// tests. A checkpoint never reached scores fail and is marked not reached. The final tree is
// the last snapshot. Refuses any snapshot holding test/hidden/ (the agent never sees those).
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { timeline, workAt, stateAt } from "./tokens.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CPS = resolve(HERE, "..", "checkpoints");
function arg(n, d = null) { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; }
const RUN = arg("--run"), REPO = arg("--repo"), OUT = arg("--out"), TR = arg("--transcripts");
const K = Number(arg("--k", "0")) || null;
const JSON_FILE = arg("--json");
if (!RUN || !REPO || !OUT) throw new Error("need --run --repo --out");
if (existsSync(OUT) && readdirSync(OUT).length) throw new Error(`--out ${OUT} is not empty`);
mkdirSync(OUT, { recursive: true });

const ALL = readdirSync(CPS).filter((d) => /^cp\d\d$/.test(d)).sort();
const SNAPS = join(RUN, "snapshots");
const snapOf = (cp) => join(SNAPS, `${cp}-done`);
const reached = ALL.filter((cp) => existsSync(snapOf(cp)));
for (const cp of reached) if (existsSync(join(snapOf(cp), "test", "hidden"))) throw new Error(`${cp} snapshot holds test/hidden: refused`);

let n = 0;
const work = () => join(OUT, `w${String(++n).padStart(3, "0")}`);
function tree(src, extra) {
  const r = spawnSync(process.execPath, [join(HERE, "check-tree.mjs"), "--src", src, "--out", work(), "--kind", "hidden", "--json", ...extra], { encoding: "utf8", maxBuffer: 1 << 26 });
  const line = (r.stdout || "").trim().split("\n").pop();
  try { return JSON.parse(line); } catch { return null; }
}
const passed = (row) => !!row?.hidden && row.hidden.total > 0 && row.hidden.failed.length === 0;

// Gate log: when each checkpoint was requested (revealed) and finished (done).
const events = existsSync(join(RUN, "gate-log.jsonl"))
  ? readFileSync(join(RUN, "gate-log.jsonl"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
const at = (ev, i) => { const e = events.find((x) => x.event === ev && x.cp === i); return e ? Date.parse(e.ts) : null; };
const tl = TR ? timeline(TR) : null;

const rows = [];
for (const [i0, cp] of ALL.entries()) {
  const i = i0 + 1;
  const row = { cp, reached: reached.includes(cp), pass: false, hidden: null, rules: null };
  if (row.reached) {
    const t = tree(snapOf(cp), ["--only", String(i)]);
    row.hidden = t?.[0]?.hidden ?? null;
    row.pass = passed(t?.[0]);
    const r = spawnSync(process.execPath, [join(HERE, "check-rules.mjs"), "--tree", snapOf(cp), "--state", join(RUN, "gate-state.json"), "--upto", String(i), "--json"], { encoding: "utf8" });
    try { row.rules = JSON.parse(r.stdout.trim()).violations; } catch { row.rules = [{ rule: 0, detail: "rule check crashed" }]; }
  }
  const req = at("revealed", i), done = at("done", i);
  row.requestedAt = req && new Date(req).toISOString();
  row.doneAt = done && new Date(done).toISOString();
  if (tl && req) row.workAtRequest = workAt(tl, req);
  rows.push(row);
}

// Regressions: on the final tree, a checkpoint that passed at its own snapshot now fails.
const final = reached.at(-1);
const regress = [];
if (final) {
  const t = tree(snapOf(final), ["--upto", String(ALL.indexOf(final) + 1)]) || [];
  for (const r of rows) {
    if (!r.pass) continue;
    const f = t.find((x) => x.cp === r.cp);
    if (!passed(f)) regress.push({ cp: r.cp, failed: f?.hidden?.failed ?? ["no result"] });
  }
}

// Rule 5 (commit messages) once, from the agent's git history.
const r5 = spawnSync(process.execPath, [join(HERE, "check-rules.mjs"), "--tree", final ? snapOf(final) : REPO, "--state", join(RUN, "gate-state.json"), "--upto", String(reached.length || 1), "--git", REPO, "--json"], { encoding: "utf8" });
let commitViolations = [];
try { commitViolations = JSON.parse(r5.stdout.trim()).violations.filter((v) => v.rule === 5); } catch {}

// Probes: each probe scored from the copy the gate froze when it was answered, with git-files
// answers keyed from history up to the head the gate logged then. atAsk says what the agent held
// when it was asked: context size, and the work and time since its last clear or compaction.
const key = JSON.parse(readFileSync(resolve(HERE, "..", "harness", "probes.json"), "utf8"));
const probes = [];
for (const p of key.probes) {
  const f = join(RUN, `probes-${p.id}.md`);
  const askedAt = events.find((e) => e.event === "probe-asked" && e.probe === p.id);
  const answeredAt = events.find((e) => e.event === "probe-answered" && e.probe === p.id);
  const atAsk = tl && askedAt ? stateAt(tl, Date.parse(askedAt.ts)) : null;
  const workAtAsk = tl && askedAt ? workAt(tl, Date.parse(askedAt.ts)) : null;
  if (!existsSync(f)) { probes.push({ id: p.id, answered: false, right: 0, total: p.questions.length, workAtAsk, atAsk }); continue; }
  const head = answeredAt?.head ? ["--head", answeredAt.head] : [];
  const r = spawnSync(process.execPath, [join(HERE, "check-probes.mjs"), "--answers", f, "--git", REPO, ...head, "--json"], { encoding: "utf8" });
  let j = null;
  try { j = JSON.parse(r.stdout.trim()); } catch {}
  const mine = (j?.rows || []).filter((x) => x.probe === p.id);
  probes.push({ id: p.id, answered: true, right: mine.filter((x) => x.ok).length, total: p.questions.length, rows: mine, workAtAsk, atAsk });
}

// A violation that stays in the tree is counted once per snapshot above. Distinct = one per
// (rule, file) over the whole run, so a single unfixed file does not read as dozens of slips.
const distinct = new Set([...rows.flatMap((r) => r.rules || []), ...commitViolations].map((v) => `${v.rule}|${v.file}|${v.rule === 5 ? v.detail : ""}`));

const late = K ? rows.slice(K - 1) : [];
const summary = {
  run: resolve(RUN),
  reached: reached.length, total: ALL.length,
  passed: rows.filter((r) => r.pass).length,
  k: K, latePassed: late.filter((r) => r.pass).length, lateTotal: late.length,
  regressions: regress.length,
  ruleViolations: rows.reduce((s, r) => s + (r.rules?.length || 0), 0) + commitViolations.length,
  ruleViolationsDistinct: distinct.size,
  probesRight: probes.reduce((s, p) => s + p.right, 0), probesTotal: probes.reduce((s, p) => s + p.total, 0),
  tokens: tl ? { sessions: tl.sessions, compactions: tl.compactions, peak: tl.peak, work: tl.work } : null,
};
const result = { summary, rows, regress, commitViolations, probes };
if (JSON_FILE) writeFileSync(JSON_FILE, JSON.stringify(result, null, 2));

console.log(`reached ${summary.reached}/${summary.total}  passed ${summary.passed}  late ${K ? `${summary.latePassed}/${summary.lateTotal} from cp${String(K).padStart(2, "0")}` : "-"}  regressions ${summary.regressions}  rule violations ${summary.ruleViolations} (${summary.ruleViolationsDistinct} distinct)  probes ${summary.probesRight}/${summary.probesTotal}`);
if (tl) console.log(`tokens: sessions ${tl.sessions}  compactions ${tl.compactions}  peak ${tl.peak}  work ${tl.work}`);
for (const r of rows) {
  if (r.pass && !r.rules?.length) continue;
  const why = !r.reached ? "not reached" : !r.pass ? `hidden ${r.hidden ? `${r.hidden.pass}/${r.hidden.total}` : "no result"}` : "";
  console.log(`  ${r.cp}  ${why}${r.rules?.length ? `  rules ${r.rules.map((v) => v.rule).join(",")}` : ""}`);
}
for (const g of regress) console.log(`  regression ${g.cp}: ${g.failed.slice(0, 3).join("; ")}`);
