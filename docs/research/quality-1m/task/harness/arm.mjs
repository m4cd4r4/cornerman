#!/usr/bin/env node
// arm.mjs: set up and run one arm of the 1M quality test, headless, on the subscription.
//   node arm.mjs setup <name>   node arm.mjs smoke <name>   node arm.mjs run <name>   node arm.mjs score <name> [--k N]
//   node arm.mjs profile        (creates or checks the pinned skills snapshot, prints its sha256)
// <name> = <arm>-<model>-r<n>, arm in default | compact250 | cm180 | cm250 | cm350 | cm500,
// model in sonnet | opus. Everything lives under I:/Scratch/_q1m/<name>/ (home, repo, run, out).
// Every arm: its own HOME and CLAUDE_CONFIG_DIR with the same config floor (the "trim" profile:
// ~/.claude CLAUDE.md + rules at 5468e7a8 plus each skill's SKILL.md from a pinned snapshot; no
// hooks, no MCPs), the same start prompt (START-PROMPT.md), the same tools, the same Claude Code
// version (CLI_VERSION, auto-update off). The house rules are not in the start prompt: the gate
// prints them once with the first checkpoint, so no arm is told them twice. CM arms add the cornerman plugin from
// GitHub, pinned to tag v0.7.2 (CM_SHA below), and run through its relay (plugin scripts/run.mjs --nudge-at N). Default and Compact-250
// run one session and resume that same session if the turn ends before ALL DONE.
// Usage limits: Default and Compact-250 wait 20 minutes and resume the same session (context kept;
// every wait and resume turn is logged and copied into score.json). A CM arm cannot resume a
// segment, the relay would start a fresh one with no handover, so a limit inside a CM run marks
// the run INVALID (out/INVALID): kept, excluded by compare.mjs, rerun by key.
// One run at a time: `run` takes the lock I:/Scratch/_q1m/.lock, because two runs share one
// 5-hour usage window and the timed tests (cp36, cp74) need an idle machine.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync, cpSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK = resolve(HERE, "..");
const [cmd, name] = process.argv.slice(2);
const m = /^(default|compact250|cm(\d+))-(sonnet|opus)-r(\d+)$/.exec(name || "");
if (!m && cmd !== "profile") throw new Error("name must be <default|compact250|cmNNN>-<sonnet|opus>-r<n>");
const arm = m?.[1], nudge = m?.[2] ? Number(m[2]) * 1000 : null, model = m?.[3];
const MODEL_ID = { sonnet: "claude-sonnet-5-5", opus: "claude-opus-5-5" }[model];
const ROOT = `I:/Scratch/_q1m/${name}`;
const HOME = join(ROOT, "home"), CONFIG = join(HOME, ".claude"), REPO = join(ROOT, "repo");
const RUN = join(ROOT, "run"), OUT = join(ROOT, "out"), TMP = join(ROOT, "tmp");
const ROAMING = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
const CLAUDE = join(ROAMING, "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
const token = () => readFileSync(join(homedir(), ".claude", "secrets", "claude-oauth-token"), "utf8").trim();
const events = (line) => { mkdirSync(OUT, { recursive: true }); appendFileSync(join(OUT, "events.log"), `${new Date().toISOString()} ${line}\n`); console.log(line); };

function env() {
  const e = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/^(ELECTRON_|VSCODE_|CLAUDE|ANTHROPIC_|TERM_PROGRAM|GIT_ASKPASS|MCP_|CORNERMAN)/i.test(k)) continue;
    e[k] = v;
  }
  return Object.assign(e, {
    USERPROFILE: HOME, HOME, HOMEDRIVE: HOME.slice(0, 2), HOMEPATH: HOME.slice(2),
    CLAUDE_CONFIG_DIR: CONFIG, TEMP: TMP, TMP, CLAUDE_CODE_OAUTH_TOKEN: token(), DISABLE_AUTOUPDATER: "1",
    ...(arm === "compact250" ? { CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: "25" } : {}),
  });
}
const sh = (exe, args, opts = {}) => {
  const r = spawnSync(exe, args, { env: env(), stdio: "inherit", ...opts });
  if (r.status !== 0) throw new Error(`${exe} ${args.join(" ")} -> exit ${r.status}`);
};

const ALLOWED = [
  "Read", "Glob", "Grep", "Edit", "Write", "TodoWrite",
  "Bash(node:*)", "Bash(npm test:*)", "Bash(npm run:*)", "Bash(git add:*)", "Bash(git commit:*)",
  "Bash(git status:*)", "Bash(git log:*)", "Bash(git diff:*)", "Bash(git show:*)", "Bash(ls:*)",
].join(",");
const SEG_BUDGET = model === "opus" ? 400 : 200; // notional caps: a runaway stop, not a spend limit
const CLAUDE_ARGS = ["-p", "--model", MODEL_ID, "--max-turns", "5000", "--max-budget-usd", String(SEG_BUDGET),
  "--allowedTools", ALLOWED, "--output-format", "stream-json", "--verbose"];

// Both pilots ran Claude Code 2.1.316. The harness uses the global install, which updates itself:
// the version is pinned here, checked at setup and at run, and auto-update is off in env().
const CLI_VERSION = "2.1.316";
function cliVersion() {
  const r = spawnSync(CLAUDE, ["--version"], { encoding: "utf8" });
  return ((r.stdout || "").trim().split(/\s+/)[0]) || `unknown (exit ${r.status})`;
}
function assertCli() {
  const v = cliVersion();
  if (v !== CLI_VERSION) throw new Error(`Claude Code is ${v}, the test is pinned to ${CLI_VERSION}: install that version or re-freeze`);
  return v;
}

// The skills in the config floor come from one snapshot, not from the live ~/.claude/skills,
// which changes most days (pilots 1 and 2 got 114 skills, a setup on 2026-11-11 got 115).
// `node arm.mjs profile` creates the snapshot once; every setup checks its sha256.
const SKILLS_DIR = "I:/Scratch/_q1m-profile-skills";
const SKILLS_SHA = "f060f542b82e454bb11dec8e2193990e620e63487c2e00610662ebab825a222b";
function skillsSha(dir) {
  const h = createHash("sha256");
  const names = readdirSync(dir).filter((d) => existsSync(join(dir, d, "SKILL.md"))).sort();
  for (const d of names) h.update(`${d}\n${readFileSync(join(dir, d, "SKILL.md"), "utf8").replace(/\r\n/g, "\n")}\n`);
  return { sha: h.digest("hex"), names };
}
function pinnedSkills() {
  if (!existsSync(SKILLS_DIR)) {
    const live = join(homedir(), ".claude", "skills");
    for (const d of skillsSha(live).names) {
      mkdirSync(join(SKILLS_DIR, d), { recursive: true });
      writeFileSync(join(SKILLS_DIR, d, "SKILL.md"), readFileSync(join(live, d, "SKILL.md")));
    }
  }
  const { sha, names } = skillsSha(SKILLS_DIR);
  if (sha !== SKILLS_SHA) throw new Error(`${SKILLS_DIR} hashes to ${sha}, expected ${SKILLS_SHA}: the snapshot changed, or it was first made from different live skills`);
  return { dir: SKILLS_DIR, sha, names };
}
function profile() {
  const p = pinnedSkills();
  console.log(`skills snapshot ${p.dir}: ${p.names.length} skills, sha256 ${p.sha}; Claude Code ${cliVersion()} (pinned ${CLI_VERSION})`);
}

function setup() {
  if (existsSync(REPO)) throw new Error(`${REPO} exists: one setup per run`);
  const cli = assertCli();
  for (const d of [CONFIG, TMP, RUN, OUT]) mkdirSync(d, { recursive: true });
  const gname = execFileSync("git", ["config", "--global", "user.name"], { encoding: "utf8" }).trim();
  const gmail = execFileSync("git", ["config", "--global", "user.email"], { encoding: "utf8" }).trim();
  writeFileSync(join(HOME, ".gitconfig"), `[user]\n\tname = ${gname}\n\temail = ${gmail}\n[core]\n\tautocrlf = false\n`);
  writeFileSync(join(CONFIG, ".claude.json"), JSON.stringify({ hasCompletedOnboarding: true }) + "\n");
  writeFileSync(join(CONFIG, "settings.json"), JSON.stringify({ model: MODEL_ID }, null, 2) + "\n");
  copyProfile();
  cpSync(join(TASK, "starter"), REPO, { recursive: true });
  sh("git", ["init", "-q"], { cwd: REPO });
  sh("git", ["add", "-A"], { cwd: REPO });
  sh("git", ["commit", "-q", "-m", "start"], { cwd: REPO });
  if (nudge) {
    sh(CLAUDE, ["plugin", "marketplace", "add", pinnedCornerman()], { cwd: HOME });
    sh(CLAUDE, ["plugin", "install", "cornerman@cornerman"], { cwd: HOME });
    events(`setup ${name}: cornerman ${pluginVersion()} installed from ${CM_TAG} at ${CM_SHA} (pinned)`);
  }
  events(`setup ${name}: claude-code ${cli} (pinned), auto-update off`);
  events(`setup ${name}: ready at ${REPO}`);
}

function copyProfile() {
  const src = join(homedir(), ".claude");
  const rev = "5468e7a8";
  const git = (...a) => execFileSync("git", ["-C", src, ...a], { encoding: "utf8", maxBuffer: 1 << 26 });
  for (const f of git("ls-tree", "-r", "--name-only", rev, "--", "CLAUDE.md", "rules").split("\n").filter(Boolean)) {
    mkdirSync(join(CONFIG, f, ".."), { recursive: true });
    writeFileSync(join(CONFIG, f), git("show", `${rev}:${f}`));
  }
  const skills = pinnedSkills();
  for (const d of skills.names) {
    mkdirSync(join(CONFIG, "skills", d), { recursive: true });
    writeFileSync(join(CONFIG, "skills", d, "SKILL.md"), readFileSync(join(skills.dir, d, "SKILL.md")));
  }
  events(`setup ${name}: profile trim (${rev}), ${skills.names.length} skills, skills sha256 ${skills.sha}`);
}

// Pilots 1 and 2 installed from GitHub main, unpinned: they got 7728e73 and 90eb44d, both
// reporting "0.7.2". The full test pins the released tag (re-freeze note 2026-11-11 in
// PREDICTIONS.md). One clone, outside _q1m so compare.mjs never reads it, checked on every setup.
const CM_TAG = "v0.7.2", CM_SHA = "a8c36539063ae3871745a41d46be376d873e84fd";
const CM_DIR = `I:/Scratch/_q1m-cornerman-${CM_TAG}`;
function pinnedCornerman() {
  const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
  if (!existsSync(CM_DIR)) {
    git("clone", "--quiet", "https://github.com/m4cd4r4/cornerman", CM_DIR);
    git("-C", CM_DIR, "-c", "advice.detachedHead=false", "checkout", "--quiet", CM_SHA);
  }
  const head = git("-C", CM_DIR, "rev-parse", "HEAD");
  const dirty = git("-C", CM_DIR, "status", "--porcelain");
  if (head !== CM_SHA || dirty) throw new Error(`${CM_DIR} is at ${head}${dirty ? " with local changes" : ""}, expected clean ${CM_SHA}`);
  return CM_DIR;
}

function pluginBase() { return join(CONFIG, "plugins", "cache", "cornerman", "cornerman"); }
function pluginVersion() { return readdirSync(pluginBase()).sort().pop(); }
function runMjs() { return join(pluginBase(), pluginVersion(), "scripts", "run.mjs"); }

function smoke() {
  const r = spawnSync(CLAUDE, ["-p", "--model", MODEL_ID, "--max-turns", "2", "--max-budget-usd", "1", "--output-format", "json",
    "--no-session-persistence", "Reply with the single word OK."], { env: env(), cwd: REPO, encoding: "utf8" });
  let line = (r.stdout || "").trim().slice(0, 200);
  try {
    const j = JSON.parse(r.stdout), u = j.usage;
    const win = Object.values(j.modelUsage || {}).map((x) => x.contextWindow).filter(Boolean);
    line = `reply ${String(j.result).slice(0, 20)} :: floor ${u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens} :: window ${win.join(",")} :: cost ${j.total_cost_usd}`;
  } catch {}
  events(`smoke ${name}: exit ${r.status} :: ${line} ${(r.stderr || "").trim().slice(0, 200)}`);
}

// --- run ---------------------------------------------------------------------------------
const gateStatus = () => {
  try { return JSON.parse(readFileSync(join(RUN, "gate-state.json"), "utf8")); } catch { return { current: 0 }; }
};
const LIMIT = /usage limit|rate limit|limit reached|resets? (at|in)|overloaded|529|5-hour limit|weekly limit/i;

// One claude process; stdout appended to out/stream-<n>.jsonl. Resolves { code, limited, cost }.
function claudeOnce(n, args, input) {
  return new Promise((done) => {
    const out = join(OUT, `stream-${String(n).padStart(2, "0")}.jsonl`);
    const child = spawn(CLAUDE, args, { cwd: REPO, env: env(), stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let tail = "", cost = null;
    child.stdout.on("data", (b) => {
      appendFileSync(out, b);
      tail = (tail + b.toString()).slice(-20000);
    });
    child.stderr.on("data", (b) => { appendFileSync(join(OUT, "stderr.log"), b); tail = (tail + b.toString()).slice(-20000); });
    child.stdin.end(input);
    child.on("close", (code) => {
      const res = tail.split("\n").reverse().find((l) => l.includes("\"type\":\"result\""));
      let limited = false;
      try { const j = JSON.parse(res); cost = j.total_cost_usd ?? null; limited = !!j.is_error && LIMIT.test(String(j.result || "")); } catch { limited = LIMIT.test(tail.slice(-3000)); }
      done({ code, limited, cost });
    });
  });
}
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const CONTINUE = "Continue the task in this repository. Run `node gate.mjs status` to see where you are, then carry on until the gate prints ALL DONE.";

async function runSession(prompt) {
  const sid = randomUUID();
  let n = 0, stale = 0, last = gateStatus().current, waits = 0;
  while (!gateStatus().finished) {
    n++;
    const args = n === 1 ? [...CLAUDE_ARGS, "--session-id", sid] : [...CLAUDE_ARGS, "--resume", sid];
    events(`segment ${n} start (${n === 1 ? "new" : "resume"} ${sid}) at cp ${gateStatus().current}`);
    const r = await claudeOnce(n, args, n === 1 ? prompt : CONTINUE);
    const now = gateStatus().current;
    events(`segment ${n} exit ${r.code} cost ${r.cost} limited ${r.limited} cp ${now}`);
    if (gateStatus().finished) break;
    if (r.limited) { waits++; events(`usage limit: wait 20 min (wait ${waits})`); await sleep(20 * 60 * 1000); continue; }
    stale = now > last ? 0 : stale + 1;
    last = now;
    if (stale >= 3) { events("stopped: 3 resumes in a row with no checkpoint progress"); break; }
  }
}

async function runRelay(prompt) {
  let pass = 0, stale = 0, last = gateStatus().current;
  writeFileSync(join(OUT, "prompt.txt"), prompt);
  while (!gateStatus().finished) {
    pass++;
    events(`relay pass ${pass} start at cp ${gateStatus().current} (cornerman ${pluginVersion()}, nudge ${nudge})`);
    const r = await new Promise((done) => {
      const child = spawn(process.execPath, [runMjs(), "--max-segments", "unlimited", "--total-budget-usd", String(SEG_BUDGET * 10),
        "--nudge-at", String(nudge), "--prompt-file", join(OUT, pass === 1 ? "prompt.txt" : "continue.txt"),
        "--event-log", join(OUT, "relay-events.log"), "--label", name, "--done-check", `node "${join(HERE, "done-check.mjs").replaceAll("\\", "/")}" "${RUN}"`,
        "--", CLAUDE, ...CLAUDE_ARGS], { cwd: REPO, env: env(), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
      // Every segment's result line is checked, not only the end of the pass: the relay starts a
      // fresh segment after a limited one, so the limit text can be far from the tail.
      let tail = "", buf = "", hit = false;
      child.stdout.on("data", (b) => {
        appendFileSync(join(OUT, `relay-${pass}.jsonl`), b);
        tail = (tail + b.toString()).slice(-20000);
        const lines = (buf + b.toString()).split("\n");
        buf = lines.pop();
        for (const l of lines) {
          if (!l.includes("\"type\":\"result\"")) continue;
          try { const j = JSON.parse(l); if (j.is_error && LIMIT.test(String(j.result || ""))) hit = true; } catch {}
        }
      });
      child.stderr.on("data", (b) => { appendFileSync(join(OUT, "stderr.log"), b); tail = (tail + b.toString()).slice(-20000); });
      child.on("close", (code) => done({ code, limited: hit || LIMIT.test(tail.slice(-6000)) }));
    });
    const now = gateStatus().current;
    events(`relay pass ${pass} exit ${r.code} limited ${r.limited} cp ${now}`);
    if (gateStatus().finished) break;
    if (r.limited) {
      // The relay cannot resume the limited segment: its next segment starts fresh with no
      // handover, an unplanned clear the Default arm never gets. Not a scored result.
      writeFileSync(join(OUT, "INVALID"), `${new Date().toISOString()} usage limit inside relay pass ${pass} at cp ${now}: the segment's context is lost. Rerun this key.\n`);
      events(`INVALID: usage limit inside relay pass ${pass} at cp ${now}; run excluded, rerun by key`);
      break;
    }
    writeFileSync(join(OUT, "continue.txt"), `${prompt}\n\n${CONTINUE}\n`);
    stale = now > last ? 0 : stale + 1;
    last = now;
    if (stale >= 3) { events("stopped: 3 relay passes in a row with no checkpoint progress"); break; }
  }
}

const LOCK = "I:/Scratch/_q1m/.lock";
async function run() {
  const cli = assertCli();
  if (existsSync(join(OUT, "INVALID"))) throw new Error(`${name} is INVALID: rerun under a new r<n>, do not continue it`);
  const locked = process.env.Q1M_PARALLEL !== "1";
  if (locked) {
    const owner = () => (existsSync(join(LOCK, "owner.txt")) ? readFileSync(join(LOCK, "owner.txt"), "utf8").trim() : "owner unknown");
    try { mkdirSync(LOCK); } catch { throw new Error(`${LOCK} exists: another run is going (${owner()}). Runs go one at a time. If that run is dead, delete the folder.`); }
    writeFileSync(join(LOCK, "owner.txt"), `${name} since ${new Date().toISOString()} pid ${process.pid}\n`);
  } else events(`run ${name}: Q1M_PARALLEL=1, lock skipped (not valid for a scored run)`);
  const prompt = readFileSync(join(HERE, "START-PROMPT.md"), "utf8");
  const gate = spawn(process.execPath, [join(HERE, "gate-server.mjs"), "--repo", REPO, "--run", RUN], { stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((ok) => gate.stdout.once("data", ok));
  events(`run ${name}: gate up, model ${MODEL_ID}, arm ${arm}${nudge ? ` nudge ${nudge}` : ""}, claude-code ${cli}`);
  writeFileSync(join(OUT, "started.txt"), new Date().toISOString() + "\n");
  try {
    if (nudge) await runRelay(prompt); else await runSession(prompt);
  } finally {
    if (locked) rmSync(LOCK, { recursive: true, force: true });
    gate.kill();
    const s = gateStatus();
    writeFileSync(join(OUT, "ended.txt"), `${new Date().toISOString()} cp ${s.current} finished ${!!s.finished}\n`);
    events(`run ${name}: ended at cp ${s.current}, finished ${!!s.finished}`);
  }
}

function score() {
  const k = process.argv.indexOf("--k");
  const out = join(ROOT, `score-${Date.now()}`);
  sh(process.execPath, [join(TASK, "tools", "score-run.mjs"), "--run", RUN, "--repo", REPO, "--out", out,
    "--transcripts", join(CONFIG, "projects"), "--json", join(ROOT, "score.json"), ...(k === -1 ? [] : ["--k", process.argv[k + 1]])]);
  // What the harness did to this run, so it travels with the score: limit waits, resume turns,
  // relay restarts with no handover, versions, and whether the run is INVALID.
  const read = (f) => (existsSync(join(OUT, f)) ? readFileSync(join(OUT, f), "utf8") : "");
  const log = read("events.log"), relay = read("relay-events.log");
  const count = (text, re) => (text.match(re) || []).length;
  const pick = (re) => (re.exec(log) || [])[1] ?? null;
  const j = JSON.parse(readFileSync(join(ROOT, "score.json"), "utf8"));
  j.harness = {
    invalid: read("INVALID").trim() || null,
    limitWaits: count(log, /usage limit: wait/g),
    resumeTurns: count(log, /segment \d+ start \(resume /g),
    relayPasses: count(log, /relay pass \d+ start/g),
    relaySegments: count(relay, / segment \S+ \d+ /g),
    relayRestartsWithoutHandover: count(relay, /done-check \S+ \d+ failed/g),
    claudeCode: pick(/claude-code (\S+)/),
    cornermanSha: pick(/installed from \S+ at ([0-9a-f]{40})/),
    skillsSha: pick(/skills sha256 ([0-9a-f]{64})/),
    parallel: /Q1M_PARALLEL=1/.test(log),
  };
  writeFileSync(join(ROOT, "score.json"), JSON.stringify(j, null, 2));
  console.log(`harness: ${JSON.stringify(j.harness)}`);
}

await ({ setup, smoke, run, score, profile }[cmd] || (() => { throw new Error("cmd: setup | smoke | run | score | profile"); }))();
