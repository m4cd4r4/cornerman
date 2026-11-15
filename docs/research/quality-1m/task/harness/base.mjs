#!/usr/bin/env node
// base.mjs: the clear-arm retest's base run (TASK-DESIGN.md, "Clear-arm retest build").
//   node base.mjs setup | verify | run | find-fork | park      [--stub <url>] [--root <dir>]
// One Default session, cp01 to the end of cp43, Sonnet, with cornerman d7c1445 installed in its
// config and its nudge OFF (CORNERMAN_AUTO=0), so nothing clears before the fork while the
// plugin's UserPromptSubmit hook logs every prompt (lib/rulings.mjs). The 14 rulings in
// rulings.json reach the agent as user messages: the gate pauses before each plant checkpoint
// (gate-server.mjs --rulings) and this script resumes the session with the ruling's text. The
// gate stops before cp44 (--stop-before 44); `find-fork` then writes out/base.json, which
// fork.mjs reads for the clear211 arm.
// --stub <url>: the dry check (retest-dry.mjs). Claude Code is pointed at stub-api.mjs with a
// dummy key and no OAuth token, so no model is called; the repo starts from the reference
// solution, so the stub "agent" (which only runs `node gate.mjs next`) passes every gate.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync, cpSync, rmSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK = resolve(HERE, "..");
const cmd = process.argv[2];
const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const STUB = arg("--stub", null);
export const BASE_NAME = "base211-sonnet";
export const BASE_LIVE = `I:/Scratch/_q1m/${BASE_NAME}`;
export const BASE_PARK = `I:/Scratch/_q1m-pilot/${BASE_NAME}`;
const ROOT = resolve(arg("--root", cmd === "park" || cmd === "verify-parked" ? BASE_PARK : BASE_LIVE));
const HOME = join(ROOT, "home"), CONFIG = join(HOME, ".claude"), REPO = join(ROOT, "repo");
const RUN = join(ROOT, "run"), OUT = join(ROOT, "out"), TMP = join(ROOT, "tmp"), STORE = join(ROOT, "cm-store");
const RULINGS = join(HERE, "rulings.json");
const STOP_BEFORE = 44;
const MODEL_ID = "claude-sonnet-5-5";
export const CM_TAG = "d7c1445", CM_SHA = "d7c14458534ddf202d74f6555bdb9d7e5d753c11", CM_VERSION = "0.7.3";
export const CM_DIR = `I:/Scratch/_q1m-cornerman-${CM_TAG}`;
const ROAMING = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
const CLAUDE = join(ROAMING, "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
const CLI_VERSION = "2.1.316";
const events = (line) => { mkdirSync(OUT, { recursive: true }); appendFileSync(join(OUT, "events.log"), `${new Date().toISOString()} ${line}\n`); console.log(line); };
const sha = (b) => createHash("sha256").update(b).digest("hex");
const git = (...a) => execFileSync("git", ["-C", REPO, ...a], { encoding: "utf8", maxBuffer: 1 << 28 });

// arm.mjs's environment, plus the plugin's: own store, no sync, auto mode (the nudge) off.
function env() {
  const e = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/^(ELECTRON_|VSCODE_|CLAUDE|ANTHROPIC_|TERM_PROGRAM|GIT_ASKPASS|MCP_|CORNERMAN)/i.test(k)) continue;
    e[k] = v;
  }
  const auth = STUB
    ? { ANTHROPIC_BASE_URL: STUB, ANTHROPIC_API_KEY: "sk-ant-stub-not-a-key" }
    : { CLAUDE_CODE_OAUTH_TOKEN: readFileSync(join(homedir(), ".claude", "secrets", "claude-oauth-token"), "utf8").trim() };
  return Object.assign(e, {
    USERPROFILE: HOME, HOME, HOMEDRIVE: HOME.slice(0, 2), HOMEPATH: HOME.slice(2),
    CLAUDE_CONFIG_DIR: CONFIG, TEMP: TMP, TMP, DISABLE_AUTOUPDATER: "1", ...auth,
    CORNERMAN_AUTO: "0", CORNERMAN_HOME: STORE, CORNERMAN_SYNC: "off",
  });
}
const ALLOWED = [
  "Read", "Glob", "Grep", "Edit", "Write", "TodoWrite",
  "Bash(node:*)", "Bash(npm test:*)", "Bash(npm run:*)", "Bash(git add:*)", "Bash(git commit:*)",
  "Bash(git status:*)", "Bash(git log:*)", "Bash(git diff:*)", "Bash(git show:*)", "Bash(ls:*)",
].join(",");
const CLAUDE_ARGS = ["-p", "--model", MODEL_ID, "--max-turns", "5000", "--max-budget-usd", "200",
  "--allowedTools", ALLOWED, "--output-format", "stream-json", "--verbose"];
const CONTINUE = "Continue the task in this repository. Run `node gate.mjs status` to see where you are, then carry on until the gate prints ALL DONE.";

function assertCli() {
  const v = ((spawnSync(CLAUDE, ["--version"], { encoding: "utf8" }).stdout || "").trim().split(/\s+/)[0]) || "unknown";
  if (v !== CLI_VERSION) throw new Error(`Claude Code is ${v}, the test is pinned to ${CLI_VERSION}`);
  return v;
}
export function pinnedCornerman() {
  const g = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
  if (!existsSync(CM_DIR)) {
    g("clone", "--quiet", "https://github.com/m4cd4r4/cornerman", CM_DIR);
    g("-C", CM_DIR, "-c", "advice.detachedHead=false", "checkout", "--quiet", CM_SHA);
  }
  const head = g("-C", CM_DIR, "rev-parse", "HEAD"), dirty = g("-C", CM_DIR, "status", "--porcelain");
  if (head !== CM_SHA || dirty) throw new Error(`${CM_DIR} is at ${head}${dirty ? " with local changes" : ""}, expected clean ${CM_SHA}`);
  return CM_DIR;
}
const pluginBase = () => join(CONFIG, "plugins", "cache", "cornerman", "cornerman");
const pluginVersion = () => readdirSync(pluginBase()).sort().pop();
const rulings = () => JSON.parse(readFileSync(RULINGS, "utf8")).rulings;

// --- setup: arm.mjs's Default setup (same config floor and pinned skills), plus the plugin ----
function setup() {
  if (existsSync(REPO)) throw new Error(`${REPO} exists: one setup per base`);
  const cli = assertCli();
  for (const d of [CONFIG, TMP, RUN, OUT]) mkdirSync(d, { recursive: true });
  const gname = execFileSync("git", ["config", "--global", "user.name"], { encoding: "utf8" }).trim();
  const gmail = execFileSync("git", ["config", "--global", "user.email"], { encoding: "utf8" }).trim();
  writeFileSync(join(HOME, ".gitconfig"), `[user]\n\tname = ${gname}\n\temail = ${gmail}\n[core]\n\tautocrlf = false\n`);
  writeFileSync(join(CONFIG, ".claude.json"), JSON.stringify({ hasCompletedOnboarding: true }) + "\n");
  // Pilot 3's settings (the fork parent of the first dial): model only, no bashOutputMaxChars.
  writeFileSync(join(CONFIG, "settings.json"), JSON.stringify({ model: MODEL_ID }, null, 2) + "\n");
  const r = spawnSync(process.execPath, [join(HERE, "arm.mjs"), "profile"], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`arm.mjs profile failed: ${r.stderr}`);
  copyProfile();
  cpSync(join(TASK, "starter"), REPO, { recursive: true });
  // Dry check only: the reference solution, so a stub that never writes code still passes the gate.
  if (STUB) cpSync(join(TASK, "reference"), REPO, { recursive: true, force: true });
  const sh = (exe, args, cwd) => { const x = spawnSync(exe, args, { cwd, env: env(), encoding: "utf8" }); if (x.status !== 0) throw new Error(`${exe} ${args.join(" ")} -> ${x.status} ${x.stderr}`); };
  sh("git", ["init", "-q"], REPO); sh("git", ["add", "-A"], REPO); sh("git", ["commit", "-q", "-m", "start"], REPO);
  sh(CLAUDE, ["plugin", "marketplace", "add", pinnedCornerman()], HOME);
  sh(CLAUDE, ["plugin", "install", "cornerman@cornerman"], HOME);
  writeFileSync(join(ROOT, "base-name.txt"), BASE_NAME + "\n");
  events(`setup ${BASE_NAME}${STUB ? " (DRY, stub)" : ""}: claude-code ${cli}, cornerman ${pluginVersion()} from ${CM_TAG} ${CM_SHA}, nudge off, ${rulings().length} rulings, rulings.json sha256 ${sha(readFileSync(RULINGS))}`);
}
// The same floor arm.mjs copies (CLAUDE.md + rules at 5468e7a8, pinned skills snapshot).
function copyProfile() {
  const src = join(homedir(), ".claude"), rev = "5468e7a8";
  const g = (...a) => execFileSync("git", ["-C", src, ...a], { encoding: "utf8", maxBuffer: 1 << 26 });
  for (const f of g("ls-tree", "-r", "--name-only", rev, "--", "CLAUDE.md", "rules").split("\n").filter(Boolean)) {
    mkdirSync(join(CONFIG, f, ".."), { recursive: true });
    writeFileSync(join(CONFIG, f), g("show", `${rev}:${f}`));
  }
  const skills = "I:/Scratch/_q1m-profile-skills";
  for (const d of readdirSync(skills).filter((d) => existsSync(join(skills, d, "SKILL.md")))) {
    mkdirSync(join(CONFIG, "skills", d), { recursive: true });
    writeFileSync(join(CONFIG, "skills", d, "SKILL.md"), readFileSync(join(skills, d, "SKILL.md")));
  }
}

// --- verify before the run (no model call) ----------------------------------------------
function verify() {
  const checks = [];
  const ok = (what, pass, detail = "") => { checks.push(pass); console.log(`${pass ? "OK  " : "FAIL"} ${what}${detail ? `: ${detail}` : ""}`); };
  ok("claude-code pinned", (() => { try { assertCli(); return true; } catch { return false; } })());
  ok(`cornerman ${CM_VERSION} installed`, existsSync(pluginBase()) && pluginVersion() === CM_VERSION, existsSync(pluginBase()) ? pluginVersion() : "missing");
  ok("cornerman has the rulings log", existsSync(join(pluginBase(), pluginVersion(), "scripts", "lib", "rulings.mjs")));
  ok("cornerman enabled", JSON.stringify(JSON.parse(readFileSync(join(CONFIG, "settings.json"), "utf8")).enabledPlugins || {}).includes("cornerman@cornerman"));
  ok("cornerman source pinned", (() => { try { return !!pinnedCornerman(); } catch { return false; } })());
  ok("env: nudge off, own store", env().CORNERMAN_AUTO === "0" && env().CORNERMAN_HOME === STORE);
  const rs = rulings();
  // 12, not 14: no fair 7th early-regime fact was found, and N3 was dropped at review (TASK-DESIGN.md, "Clear-arm retest build").
  ok("12 rulings, plants cp12-29, triggers cp44-77", rs.length === 12 && !JSON.stringify(rs).includes("PLACEHOLDER") && rs.every((r) => r.plant >= 12 && r.plant <= 29 && r.trigger >= 44 && r.trigger <= 77));
  ok("no ruling text in any spec", rs.every((r) => !readdirSync(join(TASK, "checkpoints")).some((cp) => readFileSync(join(TASK, "checkpoints", cp, "spec.md"), "utf8").includes(r.text.slice(0, 60)))));
  ok("no gate state yet", !existsSync(join(RUN, "gate-state.json")));
  const bad = checks.filter((p) => !p).length;
  events(`verify ${BASE_NAME}: ${checks.length - bad}/${checks.length} checks pass`);
  if (bad) process.exit(1);
}

// --- run ---------------------------------------------------------------------------------
const gateStatus = () => { try { return JSON.parse(readFileSync(join(RUN, "gate-state.json"), "utf8")); } catch { return { current: 0 }; } };
const gateUrl = () => JSON.parse(readFileSync(join(REPO, ".gate.json"), "utf8")).url;
const LIMIT = /usage limit|rate limit|limit reached|resets? (at|in)|overloaded|529|5-hour limit|weekly limit/i;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
function claudeOnce(n, args, input) {
  return new Promise((done) => {
    const out = join(OUT, `stream-${String(n).padStart(3, "0")}.jsonl`);
    const child = spawn(CLAUDE, args, { cwd: REPO, env: env(), stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let tail = "";
    child.stdout.on("data", (b) => { appendFileSync(out, b); tail = (tail + b.toString()).slice(-20000); });
    child.stderr.on("data", (b) => { appendFileSync(join(OUT, "stderr.log"), b); tail = (tail + b.toString()).slice(-20000); });
    child.stdin.end(input);
    child.on("close", (code) => {
      const res = tail.split("\n").reverse().find((l) => l.includes("\"type\":\"result\""));
      let limited = false, cost = null, isError = code !== 0;
      try { const j = JSON.parse(res); cost = j.total_cost_usd ?? null; isError = !!j.is_error; limited = isError && LIMIT.test(String(j.result || "")); } catch { limited = LIMIT.test(tail.slice(-3000)); }
      done({ code, limited, isError, cost });
    });
  });
}

const LOCK = "I:/Scratch/_q1m/.lock";
async function run() {
  const cli = assertCli();
  if (existsSync(join(OUT, "started.txt"))) throw new Error("this base already ran: set up a new one");
  const locked = !STUB;
  if (locked) {
    try { mkdirSync(LOCK); } catch { throw new Error(`${LOCK} exists: another run is going`); }
    writeFileSync(join(LOCK, "owner.txt"), `${BASE_NAME} since ${new Date().toISOString()} pid ${process.pid}\n`);
  }
  const gate = spawn(process.execPath, [join(HERE, "gate-server.mjs"), "--repo", REPO, "--run", RUN, "--rulings", RULINGS, "--stop-before", String(STOP_BEFORE)], { stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((ok) => gate.stdout.once("data", ok));
  const sid = randomUUID();
  writeFileSync(join(OUT, "session.txt"), sid + "\n");
  events(`run ${BASE_NAME}${STUB ? " (DRY, stub)" : ""}: session ${sid}, model ${MODEL_ID}, claude-code ${cli}, cornerman ${pluginVersion()} nudge off, stop before cp${STOP_BEFORE}`);
  writeFileSync(join(OUT, "started.txt"), new Date().toISOString() + "\n");
  let cost = 0, n = 0, stale = 0, last = 0, waits = 0, r = null, queue = [], queueCp = null;
  try {
    while (!gateStatus().baseEnd) {
      n++;
      // A pending ruling is sent as the user's message, in its own words and nothing else, one
      // ruling per message (the rulings log caps one entry at 500 chars). A limited segment
      // re-sends the same message.
      let input = n === 1 ? readFileSync(join(HERE, "START-PROMPT.md"), "utf8") : CONTINUE, how = n === 1 ? "new" : "continue";
      if (n > 1 && !(r?.limited && r.sent)) {
        if (!queue.length) {
          const p = JSON.parse(await (await fetch(`${gateUrl()}/pending-ruling`)).text());
          if (p.cp) { queue = [...p.text]; queueCp = p.cp; }
        }
        if (queue.length) {
          input = queue.shift();
          how = `ruling for cp${queueCp}${queue.length ? `, ${queue.length} more` : ""}`;
          if (!queue.length) {
            const res = await fetch(`${gateUrl()}/ruling-delivered?cp=${queueCp}`, { method: "POST" });
            if (!res.ok) throw new Error(`ruling-delivered cp${queueCp}: ${res.status}`);
          }
        }
      } else if (r?.sent) { input = r.sent; how = "re-send after limit"; }
      const args = n === 1 ? [...CLAUDE_ARGS, "--session-id", sid] : [...CLAUDE_ARGS, "--resume", sid];
      events(`segment ${n} start (${how}) at cp ${gateStatus().current}`);
      r = await claudeOnce(n, args, input);
      r.sent = how.startsWith("ruling") || how.startsWith("re-send") ? input : null;
      if (r.cost != null) cost = r.cost; // cumulative for the one session
      const now = gateStatus().current;
      events(`segment ${n} exit ${r.code} cost ${r.cost} limited ${r.limited} error ${r.isError} cp ${now}`);
      if (gateStatus().baseEnd) break;
      if (r.limited) { waits++; events(`usage limit: wait 20 min (wait ${waits})`); await sleep(20 * 60 * 1000); continue; }
      if (r.isError && n === 1) throw new Error("first segment errored: see stderr.log");
      // A ruling turn moves no checkpoint by design, so it is not a stall.
      stale = now > last || how.startsWith("ruling") ? 0 : stale + 1;
      last = now;
      if (stale >= 3) { events("stopped: 3 segments in a row with no checkpoint progress"); break; }
    }
  } finally {
    if (locked) rmSync(LOCK, { recursive: true, force: true });
    gate.kill();
    const s = gateStatus();
    writeFileSync(join(OUT, "ended.txt"), `${new Date().toISOString()} cp ${s.current} baseEnd ${s.baseEnd ?? "no"} cost ${cost}\n`);
    events(`run ${BASE_NAME}: ended at cp ${s.current}, base end ${s.baseEnd ?? "no"}, cost ${cost}, ${n} segments`);
  }
}

// --- find-fork: write out/base.json for fork.mjs -----------------------------------------
// The fork point is the transcript entry of the Bash call whose result is BASE END: the call
// that asks for cp44. Resuming at it leaves the call unanswered, so the fork asks again itself.
function findFork() {
  const sid = readFileSync(join(OUT, "session.txt"), "utf8").trim();
  const projects = join(CONFIG, "projects");
  const key = readdirSync(projects).find((k) => existsSync(join(projects, k, `${sid}.jsonl`)));
  if (!key) throw new Error(`no transcript for ${sid}`);
  const lines = readFileSync(join(projects, key, `${sid}.jsonl`), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const resultOf = new Map();
  for (const e of lines) for (const c of (Array.isArray(e.message?.content) ? e.message.content : [])) if (c.type === "tool_result") resultOf.set(c.tool_use_id, JSON.stringify(c.content));
  const at = lines.findIndex((e) => e.type === "assistant" && (e.message?.content || []).some((c) => c.type === "tool_use" && /BASE END/.test(resultOf.get(c.id) || "")));
  if (at === -1) throw new Error("no Bash call answered BASE END in the transcript");
  const e = lines[at], u = e.message.usage || {};
  const s = gateStatus();
  const log = readFileSync(join(RUN, "gate-log.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const head = log.find((j) => j.event === "base-end").head;
  const subject = git("log", "-1", "--format=%s", head).trim();
  const ended = readFileSync(join(OUT, "ended.txt"), "utf8");
  const base = {
    name: BASE_NAME, root: ROOT, session: sid, projectKey: key, forkUuid: e.uuid, forkMessage: e.message.id, forkHead: head, forkSubject: subject,
    forkCp: s.baseEnd, baseCtx: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.output_tokens || 0),
    cost: Number((/cost ([\d.]+)/.exec(ended) || [])[1] ?? NaN), transcriptLine: at + 1, rulingsSha: sha(readFileSync(RULINGS)), cornerman: { tag: CM_TAG, sha: CM_SHA },
    rulingsLog: existsSync(join(STORE, "rulings", `${sid}.jsonl`)) ? join(STORE, "rulings", `${sid}.jsonl`) : null, dry: !!STUB,
  };
  writeFileSync(join(OUT, "base.json"), JSON.stringify(base, null, 2));
  events(`find-fork: ${e.uuid} (${e.message.id}) at line ${at + 1}, head ${head.slice(0, 7)} "${subject}", context ${base.baseCtx}`);
  // The checks fork.mjs relies on.
  const fails = [];
  if (s.baseEnd !== STOP_BEFORE - 1) fails.push(`base ended at cp${s.baseEnd}, not cp${STOP_BEFORE - 1}`);
  if (!/^cp43\b/.test(subject)) fails.push(`fork head commit is "${subject}", not cp43`);
  const logged = base.rulingsLog ? readFileSync(base.rulingsLog, "utf8") : "";
  const missing = rulings().filter((r) => !logged.includes(JSON.stringify(r.text.replace(/\s+/g, " ").trim()).slice(1, 60)));
  if (missing.length) fails.push(`rulings log lacks ${missing.map((r) => r.id).join(", ")}`);
  const undelivered = rulings().filter((r) => s.rulings?.[r.plant] !== "delivered");
  if (undelivered.length) fails.push(`not delivered: ${undelivered.map((r) => r.id).join(", ")}`);
  if (fails.length) { events(`find-fork FAIL: ${fails.join("; ")}`); process.exit(1); }
  events("find-fork OK: base ended at cp43, fork head is cp43, every ruling delivered and in the rulings log");
}

function park() {
  if (existsSync(LOCK)) throw new Error("a run holds the lock");
  if (existsSync(BASE_PARK)) throw new Error(`${BASE_PARK} exists`);
  mkdirSync(dirname(BASE_PARK), { recursive: true });
  renameSync(BASE_LIVE, BASE_PARK);
  console.log(`parked at ${BASE_PARK}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await ({ setup, verify, run, "find-fork": findFork, park }[cmd] || (() => { throw new Error("cmd: setup | verify | run | find-fork | park"); }))();
