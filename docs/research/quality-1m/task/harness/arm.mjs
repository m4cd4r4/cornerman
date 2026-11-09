#!/usr/bin/env node
// arm.mjs: set up and run one arm of the 1M quality test, headless, on the subscription.
//   node arm.mjs setup <name>   node arm.mjs smoke <name>   node arm.mjs run <name>   node arm.mjs score <name> [--k N]
// <name> = <arm>-<model>-r<n>, arm in default | compact250 | cm180 | cm250 | cm350 | cm500,
// model in sonnet | opus. Everything lives under I:/Scratch/_q1m/<name>/ (home, repo, run, out).
// Every arm: its own HOME and CLAUDE_CONFIG_DIR with the same config floor (the "trim" profile:
// ~/.claude CLAUDE.md + rules at 5468e7a8 plus each local skill's SKILL.md; no hooks, no MCPs),
// the same start prompt (START-PROMPT.md), the same tools. CM arms add the cornerman plugin from
// GitHub and run through its relay (plugin scripts/run.mjs --nudge-at N). Default and Compact-250
// run one session and resume that same session if the turn ends before ALL DONE.
// A usage-limit stop waits and resumes; it is logged, never scored as a failure.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync, cpSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK = resolve(HERE, "..");
const [cmd, name] = process.argv.slice(2);
const m = /^(default|compact250|cm(\d+))-(sonnet|opus)-r(\d+)$/.exec(name || "");
if (!m) throw new Error("name must be <default|compact250|cmNNN>-<sonnet|opus>-r<n>");
const arm = m[1], nudge = m[2] ? Number(m[2]) * 1000 : null, model = m[3];
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
    CLAUDE_CONFIG_DIR: CONFIG, TEMP: TMP, TMP, CLAUDE_CODE_OAUTH_TOKEN: token(),
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

function setup() {
  if (existsSync(REPO)) throw new Error(`${REPO} exists: one setup per run`);
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
    sh(CLAUDE, ["plugin", "marketplace", "add", "https://github.com/m4cd4r4/cornerman"], { cwd: HOME });
    sh(CLAUDE, ["plugin", "install", "cornerman@cornerman"], { cwd: HOME });
    events(`setup ${name}: cornerman ${pluginVersion()} installed`);
  }
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
  let n = 0;
  for (const d of readdirSync(join(src, "skills"))) {
    const f = join(src, "skills", d, "SKILL.md");
    if (!existsSync(f)) continue;
    mkdirSync(join(CONFIG, "skills", d), { recursive: true });
    writeFileSync(join(CONFIG, "skills", d, "SKILL.md"), readFileSync(f));
    n++;
  }
  events(`setup ${name}: profile trim (${rev}), ${n} skills`);
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
  let pass = 0, waits = 0, stale = 0, last = gateStatus().current;
  writeFileSync(join(OUT, "prompt.txt"), prompt);
  while (!gateStatus().finished) {
    pass++;
    events(`relay pass ${pass} start at cp ${gateStatus().current} (cornerman ${pluginVersion()}, nudge ${nudge})`);
    const r = await new Promise((done) => {
      const child = spawn(process.execPath, [runMjs(), "--max-segments", "unlimited", "--total-budget-usd", String(SEG_BUDGET * 10),
        "--nudge-at", String(nudge), "--prompt-file", join(OUT, pass === 1 ? "prompt.txt" : "continue.txt"),
        "--event-log", join(OUT, "relay-events.log"), "--label", name, "--done-check", `node "${join(HERE, "done-check.mjs").replaceAll("\\", "/")}" "${RUN}"`,
        "--", CLAUDE, ...CLAUDE_ARGS], { cwd: REPO, env: env(), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
      let tail = "";
      child.stdout.on("data", (b) => { appendFileSync(join(OUT, `relay-${pass}.jsonl`), b); tail = (tail + b.toString()).slice(-20000); });
      child.stderr.on("data", (b) => { appendFileSync(join(OUT, "stderr.log"), b); tail = (tail + b.toString()).slice(-20000); });
      child.on("close", (code) => done({ code, limited: LIMIT.test(tail.slice(-6000)) }));
    });
    const now = gateStatus().current;
    events(`relay pass ${pass} exit ${r.code} limited ${r.limited} cp ${now}`);
    if (gateStatus().finished) break;
    writeFileSync(join(OUT, "continue.txt"), `${prompt}\n\n${CONTINUE}\n`);
    if (r.limited) { waits++; events(`usage limit: wait 20 min (wait ${waits})`); await sleep(20 * 60 * 1000); continue; }
    stale = now > last ? 0 : stale + 1;
    last = now;
    if (stale >= 3) { events("stopped: 3 relay passes in a row with no checkpoint progress"); break; }
  }
}

async function run() {
  const prompt = readFileSync(join(HERE, "START-PROMPT.md"), "utf8");
  const gate = spawn(process.execPath, [join(HERE, "gate-server.mjs"), "--repo", REPO, "--run", RUN], { stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((ok) => gate.stdout.once("data", ok));
  events(`run ${name}: gate up, model ${MODEL_ID}, arm ${arm}${nudge ? ` nudge ${nudge}` : ""}`);
  writeFileSync(join(OUT, "started.txt"), new Date().toISOString() + "\n");
  try {
    if (nudge) await runRelay(prompt); else await runSession(prompt);
  } finally {
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
}

await ({ setup, smoke, run, score }[cmd] || (() => { throw new Error("cmd: setup | smoke | run | score"); }))();
