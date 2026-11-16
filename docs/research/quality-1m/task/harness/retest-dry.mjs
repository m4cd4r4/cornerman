#!/usr/bin/env node
// retest-dry.mjs: the clear-arm retest's dry check, no model call (US$0). TASK-DESIGN.md,
// "Clear-arm retest build".   node retest-dry.mjs --dir <empty scratch folder>
// Runs the real harness (base.mjs, fork.mjs, gate-server.mjs) and the real Claude Code 2.1.316
// with cornerman d7c1445 installed, against stub-api.mjs instead of the API. The stub's
// request log is what a model would have been shown, so it is the evidence:
//   A. base, stub context 400k (above the 250k nudge): every ruling reaches the model as a user
//      message, the plugin's UserPromptSubmit hook logs each one, and the nudge says nothing.
//   B. fork r1 at 240k: the fork takes from the base's cp43 call, and the nudge stays silent.
//   C. fork r2 at 260k: the nudge fires, the stub saves through the plugin's save.mjs, the saved
//      handover has a "Rulings from the user" section with all 14, and the next fresh segment's
//      prompt carries them.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf("--dir");
if (i === -1) throw new Error("need --dir <empty folder>");
const DIR = resolve(process.argv[i + 1]);
if (existsSync(DIR) && readdirSync(DIR).length) throw new Error(`${DIR} is not empty`);
mkdirSync(DIR, { recursive: true });
const BASE = join(DIR, "base"), PARK = join(DIR, "base-parked"), FORKS = join(DIR, "forks");
const RULINGS = JSON.parse(readFileSync(join(HERE, "rulings.json"), "utf8")).rulings;
const AGENT = `node "${join(HERE, "dry-agent.mjs").replace(/\\/g, "/")}"`;
const results = [];
const check = (what, pass, detail = "") => { results.push({ what, pass, detail }); console.log(`${pass ? "OK  " : "FAIL"} ${what}${detail ? `: ${detail}` : ""}`); };

function stub(name, ctx, extra = []) {
  const log = join(DIR, `stub-${name}.jsonl`);
  const child = spawn(process.execPath, [join(HERE, "stub-api.mjs"), "--log", log, "--ctx", String(ctx), "--tool", AGENT, ...extra], { stdio: ["ignore", "pipe", "inherit"] });
  return new Promise((ok) => child.stdout.once("data", (b) => ok({ url: b.toString().trim(), log, stop: () => child.kill() })));
}
function node(script, args, env = {}) {
  const r = spawnSync(process.execPath, [join(HERE, script), ...args], { encoding: "utf8", env: { ...process.env, ...env }, maxBuffer: 1 << 26 });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  console.log(out.trim().split("\n").map((l) => `    ${l}`).join("\n"));
  return { code: r.status, out };
}
const requests = (log) => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => /\/v1\/messages/.test(r.url) && !/count_tokens/.test(r.url)) : []);
const flat = (s) => String(s).replace(/\s+/g, " ").trim();
// Text the user typed: a user message whose content is a string or text blocks, never a tool_result.
const userTexts = (reqs) => new Set(reqs.flatMap((r) => (r.body.messages || []).filter((m) => m.role === "user").flatMap((m) =>
  typeof m.content === "string" ? [m.content] : (m.content || []).filter((c) => c.type === "text").map((c) => c.text))).map(flat));
const NUDGE = /cornerman headless mode|cornerman: context|hand over and clear/i;
const nudged = (reqs) => reqs.filter((r) => NUDGE.test(JSON.stringify(r.body.messages || [])));

// --- A. base --------------------------------------------------------------------------------
console.log("A. base (stub context 400k, nudge off)");
let s = await stub("base", 400000);
for (const c of ["setup", "verify", "run", "find-fork"]) {
  const r = node("base.mjs", [c, "--stub", s.url, "--root", BASE]);
  check(`base.mjs ${c}`, r.code === 0);
  if (r.code !== 0) break;
}
s.stop();
const reqA = requests(s.log);
const typed = userTexts(reqA);
const delivered = RULINGS.filter((r) => [...typed].some((t) => t.includes(flat(r.text))));
check("every ruling reaches the model as a user message (not a tool result)", delivered.length === RULINGS.length, `${delivered.length}/${RULINGS.length}`);
const inTool = RULINGS.filter((r) => reqA.some((q) => (q.body.messages || []).some((m) => Array.isArray(m.content) && m.content.some((c) => c.type === "tool_result" && flat(JSON.stringify(c.content)).includes(flat(r.text).slice(0, 60))))));
check("no ruling text arrives inside a tool result (spec or gate output)", inTool.length === 0, inTool.map((r) => r.id).join(","));
const base = existsSync(join(BASE, "out", "base.json")) ? JSON.parse(readFileSync(join(BASE, "out", "base.json"), "utf8")) : null;
const log = base?.rulingsLog ? readFileSync(base.rulingsLog, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
const loggedIds = RULINGS.filter((r) => log.some((e) => e.text === flat(r.text)));
check("the UserPromptSubmit hook logged each ruling, verbatim", loggedIds.length === RULINGS.length, `${loggedIds.length}/${RULINGS.length}, log ${log.length} entries`);
check("the nudge said nothing in the base (context 400k, above 250k)", nudged(reqA).length === 0, `${reqA.length} requests, ${nudged(reqA).length} with a nudge`);
check("base stopped before cp44", base?.forkCp === 43, `fork head "${base?.forkSubject}", line ${base?.transcriptLine}`);
if (!base) { writeFileSync(join(DIR, "dry-result.json"), JSON.stringify(results, null, 2)); process.exit(1); }
renameSync(BASE, PARK);

// --- B and C. forks -------------------------------------------------------------------------
const forkEnv = { Q1M_BASE: PARK, Q1M_FORK_LIVE: BASE, Q1M_FORK_PARK: FORKS };
async function fork(r, ctx, segments, { arm = "clear211", stubArgs = [], env = {} } = {}) {
  const name = `fork-${arm}-sonnet-r${r}`;
  const st = node("fork.mjs", ["setup", name, "--stub", "http://127.0.0.1:9"], forkEnv);
  check(`${name} setup`, st.code === 0);
  const save = join(BASE, "home", ".claude", "plugins", "cache", "cornerman", "cornerman", "0.7.3", "scripts", "save.mjs");
  const sv = await stub(`fork-${arm}-r${r}`, ctx, ["--save", save, ...stubArgs]);
  const v = node("fork.mjs", ["verify", name, "--stub", sv.url], forkEnv);
  check(`${name} verify`, v.code === 0, (/(\d+\/\d+) checks pass/.exec(v.out) || [])[1]);
  const rn = node("fork.mjs", ["run", name, "--stub", sv.url], { ...forkEnv, Q1M_DRY_MAX_SEGMENTS: String(segments), ...env });
  check(`${name} run`, rn.code === 0);
  const capped = existsSync(join(BASE, "out", "CAPPED"));
  sv.stop();
  const f = JSON.parse(readFileSync(join(BASE, "out", "fork.json"), "utf8"));
  const store = join(BASE, "cm-store");
  const pk = node("fork.mjs", ["park", name, "--stub", sv.url], forkEnv);
  check(`${name} park`, pk.code === 0);
  return { name, reqs: requests(sv.log), f, events: rn.out, store: join(FORKS, name, "cm-store") , live: store, capped };
}

console.log("B. fork r1 (stub context 240k, nudge at 250k)");
const b = await fork(1, 240000, 1);
const first = b.reqs[0];
check("the fork carries the base history (rulings in its first request)", !!first && RULINGS.every((r) => [...userTexts([first])].some((t) => t.includes(flat(r.text)))));
check("the fork runs under its fixed session id", new RegExp(`session ${b.f.forkSession}`).test(b.events), b.f.forkSession);
check("the nudge stays silent below 250k", nudged(b.reqs).length === 0, `${b.reqs.length} requests`);

console.log("C. fork r2 (stub context 260k, 2 segments)");
const c = await fork(2, 260000, 2);
check("the nudge fires above 250k", nudged(c.reqs).length > 0, `${nudged(c.reqs).length} of ${c.reqs.length} requests`);
const walk = (d) => (existsSync(d) ? readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)])) : []);
// cornerman 0.7.3 keeps each record as <store>/handovers/*.json with the markdown in `body`.
const saved = walk(join(c.store, "handovers")).filter((f) => f.endsWith(".json"));
const bodies = saved.map((f) => { const o = JSON.parse(readFileSync(f, "utf8")); return typeof o.body === "string" ? o.body : JSON.stringify(o); }).join("\n");
check("a handover was saved through save.mjs", saved.length > 0, `${saved.length} record(s)`);
const inHandover = RULINGS.filter((r) => bodies.includes(flat(r.text)));
check("the handover's \"Rulings from the user\" holds every ruling", /## Rulings from the user/.test(bodies) && inHandover.length === RULINGS.length, `${inHandover.length}/${RULINGS.length}`);
const fresh = c.reqs.filter((q) => (q.body.messages || []).length && /cornerman: this is segment 2/.test(JSON.stringify(q.body.messages[0])));
const carried = RULINGS.filter((r) => fresh.some((q) => JSON.stringify(q.body.messages[0]).includes(JSON.stringify(flat(r.text)).slice(1, 60))));
check("segment 2 (fresh session) opens with the handover, all rulings in it", fresh.length > 0 && carried.length === RULINGS.length, `${carried.length}/${RULINGS.length}`);

// --- D. the fixed build (#214) against the agent the real forks met ---------------------------
// It ignores the first headless ask and never ends its turn. 260k + 5k per request: ask 1 at the
// first call past 250k, ask 2 once 40k more has gone by. Ceiling 600k stands in for compaction.
console.log("D. fork clear214 r3 (stub ignores the first ask, never ends its turn)");
const d = await fork(3, 260000, 2, { arm: "clear214", stubArgs: ["--ignore-asks", "1", "--never-end", "--grow", "5000", "--ceiling", "600000"] });
const askHeads = (q) => (JSON.stringify(q.body.messages || []).match(/cornerman headless mode \(/g) || []).length;
const maxAsks = Math.max(0, ...d.reqs.map(askHeads));
check("cornerman asks again after the first ask is ignored", maxAsks >= 2, `${maxAsks} asks in the longest request`);
check("the second ask says it is a reminder", d.reqs.some((q) => /cornerman headless mode \(reminder 2 of 3/.test(JSON.stringify(q.body.messages || []))));
const dSaved = walk(join(d.store, "handovers")).filter((f) => f.endsWith(".json"));
// The ceiling is (600k - 260k) / 5k = 68 requests in: the save must come well before it, and the
// runner's next segment must be a clear from that handover, not a no-handover done-check clear.
const saveAt = d.reqs.findIndex((q) => JSON.stringify(q.body.messages || []).includes("stub-saved-handover"));
check("a handover was saved before the stand-in compaction", dSaved.length > 0 && saveAt > 0 && saveAt < 60 && /clear: handover /.test(d.events), `${dSaved.length} record(s), save seen at request ${saveAt}`);
const dBodies = dSaved.map((f) => JSON.parse(readFileSync(f, "utf8")).body || "").join("\n");
check("that handover holds every ruling", RULINGS.every((r) => dBodies.includes(flat(r.text))), `${RULINGS.filter((r) => dBodies.includes(flat(r.text))).length}/${RULINGS.length}`);
const dFresh = d.reqs.filter((q) => (q.body.messages || []).length && /cornerman: this is segment 2/.test(JSON.stringify(q.body.messages[0])));
check("segment 2 starts fresh from that handover", dFresh.length > 0);

// --- E. the spend cap kills a segment mid-run ----------------------------------------------------
// Stub usage is 260k+ uncached input per request, about US$0.57 each with the margin, and the stub
// never answers an ask or ends its turn, so only the watchdog can stop segment 1: US$5 is about 9
// requests, and the kill must land inside segment 1, not at its end.
console.log("E. fork clear214 r4 (cap US$5)");
const e = await fork(4, 260000, 2, { arm: "clear214", stubArgs: ["--ignore-asks", "9", "--never-end", "--grow", "5000", "--ceiling", "900000"], env: { Q1M_CAP_USD: "5" } });
const capLine = e.events.indexOf("CAP: estimated"), seg1End = e.events.indexOf("segment 1 exit");
check("the cap killed segment 1 mid-turn and marked the run CAPPED", e.capped && capLine >= 0 && (seg1End === -1 || capLine < seg1End) && /STOP: spend cap US\$5 reached/.test(e.events), `${e.reqs.length} requests`);
check("the cap stopped it before the stub's ceiling", e.reqs.length < 120, `${e.reqs.length} requests`);

const bad = results.filter((r) => !r.pass).length;
writeFileSync(join(DIR, "dry-result.json"), JSON.stringify(results, null, 2));
console.log(`\ndry check: ${results.length - bad}/${results.length} pass`);
process.exitCode = bad ? 1 : 0;
