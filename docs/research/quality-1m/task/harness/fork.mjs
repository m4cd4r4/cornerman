#!/usr/bin/env node
// fork.mjs: the fill dial (TASK-DESIGN.md, "Fill dial"). Every arm starts from pilot 3's real
// session at the message that commits cp43 and asks the gate for cp44, and differs only in what
// happens to its context there.
//   node fork.mjs setup <name>    build the fork at the live path (US$0)
//   node fork.mjs verify <name>   static checks of the fork, no model call (US$0)
//   node fork.mjs run <name>      run the arm to ALL DONE (takes the lock)
//   node fork.mjs park <name>     move the parent transcript aside, move the fork to FORK_PARK
//   node fork.mjs score <name>    score the parked fork, late segment from cp44
// <name> = fork-<natural|compact|clear|fillNNN>-sonnet-r<n>.
//   natural  segment 1 = the continue prompt.
//   fillNNN  segment 1 = the top-up turn (checked against NNN k), then continue.
//   compact  segment 1 = `/compact` on the fork (checked: a manual compact_boundary), then continue.
//   clear    cornerman v0.7.2 as shipped: plugin installed in the fork config, headless auto mode,
//            nudge at 250k. Segment 1 = the fork with the continue prompt; the hooks ask at once
//            (context 457k) and the agent saves a handover. Every later segment is a fresh session
//            fed resumePrompt(START-PROMPT, handover), the loop of the plugin's runChain
//            (scripts/lib/run.mjs) reproduced here because the shipped relay cannot start from a fork.
//            One change from the relay: a usage limit or an error result resumes the SAME session
//            (as the other arms do), where the relay would start a fresh one with no handover.
//
// Why the live path is fixed: the transcript holds absolute paths under
// I:/Scratch/_q1m/default-sonnet-r3/ (repo, home, tool results), so each fork runs there, one at
// a time under the same lock as arm.mjs, and is parked afterwards.
// Config floor: pilot 3's own files (settings.json without bashOutputMaxChars, CLAUDE.md, rules,
// the 115 pinned skills, .claude.json), so the fork continues under the config it grew in.
// Top-up (fill arms): one user turn before the continue prompt, so it cannot be grepped away.
// It holds a side job on a real public codebase (undici 6.28.1 from npm, wasm blobs left out) and
// this repo's own `git log -p` to cp43. Sized at 2.4 chars a token (measured on pilot 3's tool
// results); the run checks the context the turn actually produced before it goes on.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync, cpSync, rmSync, renameSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK = resolve(HERE, "..");
const CPS = join(TASK, "checkpoints");
const [cmd, name] = process.argv.slice(2);
const m = /^fork-(natural|compact|clear|fill(\d+))-(sonnet)-r(\d+)$/.exec(name || "");
if (!m) throw new Error("name must be fork-<natural|compact|clear|fillNNN>-sonnet-r<n>");
const arm = m[1], fillTo = m[2] ? Number(m[2]) * 1000 : null;
// clear arm: cornerman pinned exactly as arm.mjs pins it.
const CM_TAG = "v0.7.2", CM_SHA = "a8c36539063ae3871745a41d46be376d873e84fd";
const CM_DIR = `I:/Scratch/_q1m-cornerman-${CM_TAG}`;
const CM_NUDGE = 250000;
const MODEL_ID = "claude-sonnet-5-5";

// The parent: pilot 3, scored and parked.
const PARENT = "I:/Scratch/_q1m-pilot/default-sonnet-r3";
const PARENT_SID = "9f17f65f-b298-4272-877c-a8eb2e286255";
const FORK_MSG = "msg_011Cgy5CiyhMKuLH8UdtZW6i";
// --resume-session-at takes the transcript entry's uuid, not the API message id (r1 failed on
// that, US$0): the entry at line 2695, the Bash call that commits cp43 and runs the gate.
const FORK_UUID = "21df1607-cafb-4752-84ca-93fd876f2e2f";
const FORK_HEAD = "55ac83d0a688cb1739566a1516b10133ef444c58"; // "cp43: COUNTIF and AVERAGEIF"
const PARENT_COST = 23.73828820000001; // pilot 3's own total_cost_usd, carried into every fork
const FORK_CP = 43; // gate state: cp43 revealed, not yet done
const BASE_CTX = 457180; // context at the fork message: 2 + 2,040 + 454,259 input, 879 output
const PROJECT_KEY = "I--Scratch--q1m-default-sonnet-r3-repo";
const LIVE = "I:/Scratch/_q1m/default-sonnet-r3";
const FORK_PARK = "I:/Scratch/_q1m-fork";
const ROOT = cmd === "score" ? join(FORK_PARK, name) : LIVE;
const HOME = join(ROOT, "home"), CONFIG = join(HOME, ".claude"), REPO = join(ROOT, "repo");
const RUN = join(ROOT, "run"), OUT = join(ROOT, "out"), TMP = join(ROOT, "tmp");
const TRANSCRIPTS = join(CONFIG, "projects", PROJECT_KEY);

const TOPUP_DIR = "I:/Scratch/_q1m-topup";
const UNDICI_TGZ_SHA = "e18191aac9c0ff43dac7fe9b10b7041a22d07addb7b66a6e8ac14a52a5b69b74";
const CHARS_PER_TOKEN = 2.4;
const FILL_BAND = 40000; // the top-up turn must land within this of the target, else stop

const ROAMING = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
const CLAUDE = join(ROAMING, "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
const CLI_VERSION = "2.1.316";
const token = () => readFileSync(join(homedir(), ".claude", "secrets", "claude-oauth-token"), "utf8").trim();
const events = (line) => { mkdirSync(OUT, { recursive: true }); appendFileSync(join(OUT, "events.log"), `${new Date().toISOString()} ${line}\n`); console.log(line); };
const sha = (b) => createHash("sha256").update(b).digest("hex");
const git = (...a) => execFileSync("git", ["-C", REPO, ...a], { encoding: "utf8", maxBuffer: 1 << 28 });

// Same environment and arguments as arm.mjs (Default arm).
function env() {
  const e = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/^(ELECTRON_|VSCODE_|CLAUDE|ANTHROPIC_|TERM_PROGRAM|GIT_ASKPASS|MCP_|CORNERMAN)/i.test(k)) continue;
    e[k] = v;
  }
  return Object.assign(e, {
    USERPROFILE: HOME, HOME, HOMEDRIVE: HOME.slice(0, 2), HOMEPATH: HOME.slice(2),
    CLAUDE_CONFIG_DIR: CONFIG, TEMP: TMP, TMP, CLAUDE_CODE_OAUTH_TOKEN: token(), DISABLE_AUTOUPDATER: "1",
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
  const r = spawnSync(CLAUDE, ["--version"], { encoding: "utf8" });
  const v = ((r.stdout || "").trim().split(/\s+/)[0]) || "unknown";
  if (v !== CLI_VERSION) throw new Error(`Claude Code is ${v}, the test is pinned to ${CLI_VERSION}`);
  return v;
}

// --- setup -------------------------------------------------------------------------------
function setup() {
  if (existsSync(LIVE)) throw new Error(`${LIVE} exists: park the last fork first`);
  if (existsSync(join(FORK_PARK, name))) throw new Error(`${FORK_PARK}/${name} exists: one setup per run`);
  if (existsSync("I:/Scratch/_q1m/.lock")) throw new Error("a run holds I:/Scratch/_q1m/.lock");
  const cli = assertCli();
  for (const d of [CONFIG, TMP, RUN, OUT, TRANSCRIPTS]) mkdirSync(d, { recursive: true });
  writeFileSync(join(ROOT, "fork-name.txt"), name + "\n");

  // Config floor = pilot 3's.
  const P = join(PARENT, "home");
  cpSync(join(P, ".gitconfig"), join(HOME, ".gitconfig"));
  for (const f of [".claude.json", "settings.json", "CLAUDE.md", "rules", "skills"]) cpSync(join(P, ".claude", f), join(CONFIG, f), { recursive: true });

  // Repo at cp43 committed, cp44 not revealed. node_modules is ignored and pilot 3 has none.
  execFileSync("git", ["clone", "--quiet", "--no-hardlinks", join(PARENT, "repo"), REPO]);
  git("-c", "advice.detachedHead=false", "checkout", "--quiet", "-B", "master", FORK_HEAD);
  git("remote", "remove", "origin");
  // Visible tests cp01-43 were untracked in pilot 3's tree (the gate writes them).
  const parentState = JSON.parse(readFileSync(join(PARENT, "run", "gate-state.json"), "utf8"));
  const cps = readdirSync(CPS).filter((d) => /^cp\d\d$/.test(d)).sort().slice(0, FORK_CP);
  mkdirSync(join(REPO, "test", "visible"), { recursive: true });
  const visibleHashes = {};
  for (const cp of cps) {
    const vis = readFileSync(join(CPS, cp, "visible.test.mjs"), "utf8");
    if (sha(vis) !== parentState.visibleHashes[cp]) throw new Error(`${cp} visible test differs from pilot 3's`);
    writeFileSync(join(REPO, "test", "visible", `${cp}.test.mjs`), vis);
    visibleHashes[cp] = sha(vis);
  }

  // Gate state and log as they stood when the fork message was sent: cp43 revealed (log line 92),
  // its done event not yet written. Probes P1-P3 answered; P4 (after cp50) and P5 (cp65) ahead.
  const log = readFileSync(join(PARENT, "run", "gate-log.jsonl"), "utf8").trim().split("\n");
  const cut = log.findIndex((l) => { const j = JSON.parse(l); return j.event === "revealed" && j.cp === FORK_CP; });
  if (cut === -1) throw new Error("cp43 reveal not in pilot 3's gate log");
  const kept = log.slice(0, cut + 1);
  const probes = {};
  for (const l of kept) { const j = JSON.parse(l); if (j.event === "probe-answered") probes[j.probe] = "answered"; }
  writeFileSync(join(RUN, "gate-log.jsonl"), kept.join("\n") + "\n");
  writeFileSync(join(RUN, "gate-state.json"), JSON.stringify({ current: FORK_CP, visibleHashes, probes }, null, 2));
  for (const p of Object.keys(probes)) cpSync(join(PARENT, "run", `probes-${p}.md`), join(RUN, `probes-${p}.md`));
  for (const cp of cps.slice(0, FORK_CP - 1)) cpSync(join(PARENT, "run", "snapshots", `${cp}-done`), join(RUN, "snapshots", `${cp}-done`), { recursive: true });

  // The parent transcript, under the same project key and session id.
  const tr = join(PARENT, "home", ".claude", "projects", PROJECT_KEY, `${PARENT_SID}.jsonl`);
  cpSync(tr, join(TRANSCRIPTS, `${PARENT_SID}.jsonl`));

  const info = { name, arm, fillTo, parent: PARENT, parentSession: PARENT_SID, forkMessage: FORK_MSG, forkHead: FORK_HEAD, cli,
    transcriptSha: sha(readFileSync(tr)), probesAnswered: Object.keys(probes), gateLogLines: kept.length };
  if (fillTo) Object.assign(info, buildTopup());
  if (arm === "clear") {
    // The plugin goes into the fork's own config, as arm.mjs installs it for the CM arms.
    for (const a of [["plugin", "marketplace", "add", pinnedCornerman()], ["plugin", "install", "cornerman@cornerman"]]) {
      const r = spawnSync(CLAUDE, a, { cwd: HOME, env: env(), encoding: "utf8" });
      if (r.status !== 0) throw new Error(`claude ${a.join(" ")} -> exit ${r.status}: ${r.stderr}`);
    }
    Object.assign(info, { cornerman: pluginVersion(), cornermanTag: CM_TAG, cornermanSha: CM_SHA, nudgeAt: CM_NUDGE });
  }
  writeFileSync(join(OUT, "fork.json"), JSON.stringify(info, null, 2));
  events(`setup ${name}: fork of ${PARENT_SID} at ${FORK_MSG}, repo at ${FORK_HEAD.slice(0, 7)}, gate cp${FORK_CP}, claude-code ${cli}${fillTo ? `, top-up ${info.topupChars} chars (~${info.topupTokensEst} tokens) for ${fillTo}` : ""}${info.cornerman ? `, cornerman ${info.cornerman} (${CM_TAG} ${CM_SHA.slice(0, 7)}) nudge ${CM_NUDGE}` : ""}`);
}

function pinnedCornerman() {
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
const pluginDir = () => join(pluginBase(), pluginVersion());

// The top-up turn. Undici files go in in path order until the char budget is met; the
// budget is what is left of the target after the git history and the framing.
function buildTopup() {
  const tgz = join(TOPUP_DIR, "undici-6.28.1.tgz");
  if (sha(readFileSync(tgz)) !== UNDICI_TGZ_SHA) throw new Error(`${tgz} hash changed`);
  const pkg = join(TOPUP_DIR, "undici-6.28.1", "package");
  const walk = (d) => readdirSync(d).sort().flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const files = [join(pkg, "index.js"), ...walk(join(pkg, "lib")).filter((p) => p.endsWith(".js") && !/-wasm\.js$/.test(p))];
  const history = git("log", "-p", "--no-color");
  const head = "Separate job before you go on with the spreadsheet engine. Below is the source of undici 6.28.1, the HTTP/1.1 client that Node.js ships for `fetch`, then this repository's own history so far (`git log -p`). The undici part is the job: reply with five short lines on how a call to `request()` reaches a socket and how its response body gets back to the caller. Do not run any tools for this and do not change this repository. After your reply I will tell you to carry on with the checkpoints.\n\n";
  const mid = "\n\n=== end of undici ===\n\nThis repository's history to cp43, for reference (`git log -p`):\n\n";
  const tail = "\n\n=== end of history ===\n\nReply with the five lines about undici now.\n";
  const budget = Math.round((fillTo - BASE_CTX) * CHARS_PER_TOKEN) - history.length - head.length - mid.length - tail.length;
  if (budget < 50000) throw new Error(`top-up budget ${budget} chars: target too low for this content`);
  let body = "", used = [];
  for (const f of files) {
    const rel = relative(pkg, f).replaceAll("\\", "/");
    const block = `\n===== undici/${rel} =====\n${readFileSync(f, "utf8")}`;
    if (body.length + block.length > budget) break;
    body += block; used.push(rel);
  }
  const text = head + body + mid + history + tail;
  writeFileSync(join(ROOT, "topup.txt"), text);
  return { topupChars: text.length, topupTokensEst: Math.round(text.length / CHARS_PER_TOKEN), topupSha: sha(text),
    undiciFiles: used.length, undiciChars: body.length, historyChars: history.length, charsPerToken: CHARS_PER_TOKEN };
}

// --- verify (no model call) --------------------------------------------------------------
function verify() {
  const checks = [];
  const ok = (what, pass, detail = "") => { checks.push({ what, pass }); console.log(`${pass ? "OK  " : "FAIL"} ${what}${detail ? `: ${detail}` : ""}`); };
  ok("fork name matches the live folder", readFileSync(join(ROOT, "fork-name.txt"), "utf8").trim() === name);
  ok("claude-code pinned", (() => { try { assertCli(); return true; } catch { return false; } })());
  ok("repo HEAD is cp43", git("rev-parse", "HEAD").trim() === FORK_HEAD);
  const st = git("status", "--porcelain").trim().split("\n").filter(Boolean);
  ok("only test/visible untracked", st.length === 1 && st[0] === "?? test/visible/", st.join(" | "));
  ok("PROBES.md holds P1-P3 only", (() => { const t = readFileSync(join(REPO, "PROBES.md"), "utf8"); return /P3\.10:/.test(t) && !/P4\./.test(t); })());
  const s = JSON.parse(readFileSync(join(RUN, "gate-state.json"), "utf8"));
  ok("gate at cp43, not finished", s.current === FORK_CP && !s.finished);
  ok("gate probes P1-P3 answered", JSON.stringify(s.probes) === JSON.stringify({ P1: "answered", P2: "answered", P3: "answered" }), JSON.stringify(s.probes));
  ok("43 visible tests, hashes match the checkpoints", Object.keys(s.visibleHashes).length === FORK_CP
    && Object.entries(s.visibleHashes).every(([cp, h]) => sha(readFileSync(join(REPO, "test", "visible", `${cp}.test.mjs`), "utf8")) === h));
  ok("snapshots cp01-42 present, cp43 not", readdirSync(join(RUN, "snapshots")).length === FORK_CP - 1 && !existsSync(join(RUN, "snapshots", "cp43-done")));
  const vt = spawnSync(process.execPath, ["--test", "--test-reporter=tap", "test/visible/**/*.test.mjs"], { cwd: REPO, encoding: "utf8", timeout: 180000 });
  const pass = Number((/^# pass (\d+)/m.exec(vt.stdout || "") || [])[1] || 0), fail = Number((/^# fail (\d+)/m.exec(vt.stdout || "") || [])[1] || 0);
  ok("visible tests cp01-43 pass on the fork tree", vt.status === 0 && pass > 0 && fail === 0, `pass ${pass} fail ${fail}`);
  const tr = readFileSync(join(TRANSCRIPTS, `${PARENT_SID}.jsonl`), "utf8").split("\n");
  const at = tr.findIndex((l) => l.includes(`"id":"${FORK_MSG}"`) && l.includes(`"uuid":"${FORK_UUID}"`) && l.includes("node gate.mjs next"));
  ok("transcript has the fork message (Bash: commit cp43 && gate next)", at !== -1, `line ${at + 1}`);
  const sid = (l) => { try { return JSON.parse(l).sessionId; } catch { return null; } };
  ok("transcript session id", sid(tr[0]) === PARENT_SID || sid(tr[1]) === PARENT_SID);
  ok("transcript paths point at the live fork", tr[at].includes("I:\\\\Scratch\\\\_q1m\\\\default-sonnet-r3\\\\repo") || tr.slice(0, at).some((l) => l.includes("_q1m\\\\default-sonnet-r3\\\\repo")));
  if (fillTo) {
    const f = JSON.parse(readFileSync(join(OUT, "fork.json"), "utf8"));
    ok("top-up file matches its recorded hash", sha(readFileSync(join(ROOT, "topup.txt"), "utf8")) === f.topupSha, `${f.topupChars} chars, ~${f.topupTokensEst} tokens, ${f.undiciFiles} undici files`);
    ok("top-up has no spreadsheet words in the undici part", !/spreadsheet|formula|COUNTIF|#REF!|#DIV\/0|workbook/i.test(readFileSync(join(ROOT, "topup.txt"), "utf8").split("=== end of undici ===")[0].slice(600)));
  }
  if (arm === "clear") {
    ok("cornerman 0.7.2 installed in the fork config", existsSync(pluginBase()) && pluginVersion() === "0.7.2" && existsSync(join(pluginDir(), "scripts", "save.mjs")), existsSync(pluginBase()) ? pluginVersion() : "missing");
    ok("cornerman enabled in settings.json", JSON.stringify(JSON.parse(readFileSync(join(CONFIG, "settings.json"), "utf8")).enabledPlugins || {}).includes("cornerman@cornerman"));
    ok("cornerman source pinned", (() => { try { return !!pinnedCornerman(); } catch { return false; } })());
    ok("no cornerman store yet", !existsSync(join(ROOT, "cm-store")));
  } else {
    ok("no cornerman plugin in the config", !existsSync(join(CONFIG, "plugins")));
  }
  const bad = checks.filter((c) => !c.pass).length;
  events(`verify ${name}: ${checks.length - bad}/${checks.length} checks pass`);
  if (bad) process.exit(1);
}

// --- run ---------------------------------------------------------------------------------
const gateStatus = () => { try { return JSON.parse(readFileSync(join(RUN, "gate-state.json"), "utf8")); } catch { return { current: 0 }; } };
const LIMIT = /usage limit|rate limit|limit reached|resets? (at|in)|overloaded|529|5-hour limit|weekly limit/i;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

// One claude process. Resolves { code, limited, isError, cost, session, ctx, compact } where ctx is
// the context size of the last assistant message (the top-up check reads it) and compact the
// last compact_boundary's metadata. `forked`: the session descends from pilot 3, so its
// total_cost_usd carries pilot 3's cost; a fresh clear-arm session's does not.
function claudeOnce(n, args, input, { extraEnv = {}, forked = true } = {}) {
  return new Promise((done) => {
    const out = join(OUT, `stream-${String(n).padStart(2, "0")}.jsonl`);
    const child = spawn(CLAUDE, args, { cwd: REPO, env: { ...env(), ...extraEnv }, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    // ctx keeps the last NON-ZERO context: a usage-limit result carries an assistant message with
    // all-zero usage, which in r2 read as "the fork never took" and caused a second fork at cp48.
    let tail = "", buf = "", session = null, ctx = null, compact = null;
    child.stdout.on("data", (b) => {
      appendFileSync(out, b);
      tail = (tail + b.toString()).slice(-20000);
      const lines = (buf + b.toString()).split("\n");
      buf = lines.pop();
      for (const l of lines) {
        try {
          const j = JSON.parse(l);
          if (j.session_id && !session) session = j.session_id;
          if (j.subtype === "compact_boundary") compact = j.compact_metadata || {};
          const u = j.type === "assistant" && j.message?.usage;
          const c = u ? u.input_tokens + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) : 0;
          if (c > 0) ctx = c;
        } catch {}
      }
    });
    child.stderr.on("data", (b) => { appendFileSync(join(OUT, "stderr.log"), b); tail = (tail + b.toString()).slice(-20000); });
    child.stdin.end(input);
    child.on("close", (code) => {
      const res = tail.split("\n").reverse().find((l) => l.includes("\"type\":\"result\""));
      let limited = false, cost = null, isError = code !== 0;
      // A forked session's total_cost_usd includes the parent's (r2: every segment reported
      // pilot 3's US$23.74 on top), so the parent's cost is taken off. It is cumulative over the
      // session, so run() keeps the last figure per session and sums sessions.
      try { const j = JSON.parse(res); cost = j.total_cost_usd == null ? null : Math.max(0, j.total_cost_usd - (forked ? PARENT_COST : 0)); isError = !!j.is_error; limited = isError && LIMIT.test(String(j.result || "")); } catch { isError = true; limited = LIMIT.test(tail.slice(-3000)); }
      done({ code, limited, isError, cost, session, ctx, compact });
    });
  });
}

const LOCK = "I:/Scratch/_q1m/.lock";
async function run() {
  const cli = assertCli();
  if (readFileSync(join(ROOT, "fork-name.txt"), "utf8").trim() !== name) throw new Error(`the live fork is not ${name}`);
  if (existsSync(join(OUT, "INVALID")) || existsSync(join(OUT, "started.txt"))) throw new Error(`${name} already ran: set up a new r<n>`);
  try { mkdirSync(LOCK); } catch { throw new Error(`${LOCK} exists: another run is going`); }
  writeFileSync(join(LOCK, "owner.txt"), `${name} since ${new Date().toISOString()} pid ${process.pid}\n`);
  const gate = spawn(process.execPath, [join(HERE, "gate-server.mjs"), "--repo", REPO, "--run", RUN], { stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((ok) => gate.stdout.once("data", ok));
  events(`run ${name}: gate up at cp ${gateStatus().current}, model ${MODEL_ID}, arm ${arm}, claude-code ${cli}${arm === "clear" ? `, cornerman ${pluginVersion()} nudge ${CM_NUDGE}` : ""}`);
  writeFileSync(join(OUT, "started.txt"), new Date().toISOString() + "\n");
  // total_cost_usd is cumulative per session: keep the last figure per session, sum the sessions.
  const costs = new Map();
  const total = () => [...costs.values()].reduce((a, b) => a + b, 0);
  const WAIT = 20 * 60 * 1000;
  let waits = 0;
  const wait = async (why) => { waits++; events(`usage limit${why}: wait 20 min (wait ${waits})`); await sleep(WAIT); };
  try {
    const cm = arm === "clear" ? await clearKit() : null;
    let chain = 1, chainStarted = Date.now();
    // Segment 1 forks. Until a model call has run the fork is retried after a limit wait.
    let sid = null, n = 0, r = null;
    const forkArgs = [...CLAUDE_ARGS, "--resume", PARENT_SID, "--resume-session-at", FORK_UUID, "--fork-session"];
    const first = arm === "compact" ? "/compact" : fillTo ? readFileSync(join(ROOT, "topup.txt"), "utf8") : CONTINUE;
    while (!sid) {
      n++;
      events(`segment ${n} start (fork of ${PARENT_SID} at ${FORK_MSG}, ${arm === "compact" ? "/compact" : fillTo ? "top-up turn" : "continue"}) at cp ${gateStatus().current}`);
      r = await claudeOnce(n, forkArgs, first, { extraEnv: cm ? cm.env(chain) : {} });
      if (r.session && r.cost != null) costs.set(r.session, r.cost);
      events(`segment ${n} exit ${r.code} cost ${r.cost} limited ${r.limited} session ${r.session} context ${r.ctx}${r.compact ? ` compact ${r.compact.trigger} ${r.compact.pre_tokens}->${r.compact.post_tokens}` : ""} cp ${gateStatus().current}`);
      // The fork took once a model call ran (a context, a compaction, or the gate moved). Before
      // that a limit means fork again after the wait; after it, wait and resume THIS session.
      const took = !!r.ctx || !!r.compact || gateStatus().current !== FORK_CP;
      if (r.limited && !took) { await wait(" before the fork took"); continue; }
      // An error result still carries a session id, so the fork counts only once a model call ran.
      if (!r.session || !took) {
        writeFileSync(join(OUT, "INVALID"), `${new Date().toISOString()} fork did not take (exit ${r.code}, no model call): see stderr.log\n`);
        events(`STOP: fork did not take (exit ${r.code}, context ${r.ctx}); run marked INVALID`);
        return;
      }
      sid = r.session;
      writeFileSync(join(OUT, "session.txt"), sid + "\n");
      if (fillTo) {
        // The top-up check: the turn must land near its target, and must not have moved the gate.
        if (gateStatus().current !== FORK_CP) { events(`STOP: the top-up turn moved the gate to cp ${gateStatus().current}`); return; }
        if (!r.ctx || Math.abs(r.ctx - fillTo) > FILL_BAND) {
          writeFileSync(join(OUT, "INVALID"), `${new Date().toISOString()} top-up landed at ${r.ctx}, target ${fillTo} +/- ${FILL_BAND}: resize and set up a new r<n>.\n`);
          events(`STOP: top-up landed at ${r.ctx}, outside ${fillTo} +/- ${FILL_BAND}; run marked INVALID`);
          return;
        }
        events(`top-up OK: context ${r.ctx} (target ${fillTo})`);
      }
      if (arm === "compact") {
        // The check: one manual compaction of the full fork context, gate not moved.
        if (!r.compact || r.compact.trigger !== "manual" || !(r.compact.pre_tokens > BASE_CTX - 20000) || gateStatus().current !== FORK_CP) {
          writeFileSync(join(OUT, "INVALID"), `${new Date().toISOString()} /compact did not compact the fork: ${JSON.stringify(r.compact)} cp ${gateStatus().current}\n`);
          events(`STOP: /compact did not compact the fork (${JSON.stringify(r.compact)}); run marked INVALID`);
          return;
        }
        events(`compact OK: ${r.compact.pre_tokens} -> ${r.compact.post_tokens} tokens`);
      }
    }
    // Then the same loop as arm.mjs runSession: resume the session with CONTINUE. The clear arm
    // instead starts a fresh session whenever the last segment saved a handover (runChain).
    // cur.first: a fresh clear segment's opening prompt, kept until a model call has run on it, so
    // a limit before that call re-sends it (in a new session id) instead of a bare CONTINUE.
    let cur = { sid, forked: true, first: null }, stale = 0, last = gateStatus().current;
    const fresh = (prompt) => { cur = { sid: randomUUID(), forked: false, first: prompt }; return [[...CLAUDE_ARGS, "--session-id", cur.sid], prompt]; };
    while (!gateStatus().finished) {
      if (r.limited) await wait("");
      let args = [...CLAUDE_ARGS, "--resume", cur.sid], input = CONTINUE, how = `resume ${cur.sid}`;
      const saved = cm ? cm.savedSince(chainStarted) : [];
      if (r.limited && !r.ctx && cur.first) {
        [args, input] = fresh(cur.first);
        how = `clear: chain segment ${chain} again, its first call hit the limit, fresh ${cur.sid}`;
      } else if (saved.length) {
        const h = cm.take(saved);
        chain++; chainStarted = Date.now();
        [args, input] = fresh(cm.resumePrompt(chain, h.body));
        how = `clear: handover ${h.short} (${h.body.length} chars), chain segment ${chain}, fresh ${cur.sid}`;
      } else if (cm && !r.limited && !r.isError) {
        // Ended its turn with no handover and the gate not done: the relay's done-check path.
        const dc = cm.doneCheck();
        chain++; chainStarted = Date.now();
        [args, input] = fresh(cm.unfinishedPrompt(chain, dc));
        how = `clear: no handover, done check exit ${dc.code}, chain segment ${chain}, fresh ${cur.sid}`;
      }
      n++;
      events(`segment ${n} start (${how}) at cp ${gateStatus().current}`);
      r = await claudeOnce(n, args, input, { extraEnv: cm ? cm.env(chain) : {}, forked: cur.forked });
      if (r.cost != null) costs.set(cur.sid, r.cost);
      if (r.ctx) cur.first = null;
      const now = gateStatus().current;
      events(`segment ${n} exit ${r.code} cost ${r.cost} limited ${r.limited} error ${r.isError} context ${r.ctx}${r.compact ? ` compacted ${r.compact.trigger} ${r.compact.pre_tokens}->${r.compact.post_tokens}` : ""} cp ${now}`);
      if (gateStatus().finished) break;
      if (r.limited) continue;
      stale = now > last ? 0 : stale + 1;
      last = now;
      if (stale >= 3) { events("stopped: 3 segments in a row with no checkpoint progress"); break; }
    }
  } finally {
    rmSync(LOCK, { recursive: true, force: true });
    gate.kill();
    const s = gateStatus();
    writeFileSync(join(OUT, "ended.txt"), `${new Date().toISOString()} cp ${s.current} finished ${!!s.finished} cost ${total().toFixed(2)}\n`);
    events(`run ${name}: ended at cp ${s.current}, finished ${!!s.finished}, cost ${total().toFixed(2)} (${costs.size} sessions)`);
  }
}

// The clear arm's relay pieces, from the installed plugin (store) and copied verbatim from
// scripts/lib/run.mjs at v0.7.2 (prompts, savedSince, the archive calls), max segments unlimited.
async function clearKit() {
  const D = pluginDir();
  if (pluginVersion() !== "0.7.2") throw new Error(`cornerman ${pluginVersion()} installed, expected 0.7.2`);
  const S = await import(pathToFileURL(join(D, "scripts", "lib", "store.mjs")).href);
  const P = await import(pathToFileURL(join(D, "packages", "store", "store.mjs")).href);
  const STORE = join(ROOT, "cm-store"), RUNNER = "cornerman-run";
  const { top } = S.repoInfo(REPO), key = S.repoKey(top);
  const START = readFileSync(join(HERE, "START-PROMPT.md"), "utf8");
  const DONE_CHECK = `node "${join(HERE, "done-check.mjs").replaceAll("\\", "/")}" "${RUN}"`;
  return {
    env: (chain) => ({ CORNERMAN_AUTO: "1", CORNERMAN_HEADLESS: "1", CORNERMAN_HOME: STORE, CORNERMAN_SYNC: "off",
      CORNERMAN_CHAIN: String(chain), CORNERMAN_BUDGET: "-1", CORNERMAN_NUDGE_AT: String(CM_NUDGE) }),
    savedSince(since) {
      if (!existsSync(STORE)) return [];
      const auto = new Set(P.listAll(STORE).filter((r) => r.auto === true).map((r) => r.id));
      return S.listWaiting(STORE, top).filter((h) => auto.has(h.id) && Date.parse(h.meta.created) >= since - 1000);
    },
    take(saved) {
      for (const h of saved.slice(0, -1)) S.archive(STORE, key, h.path, { via: "supersede", owner: RUNNER });
      const h = saved.at(-1);
      S.archive(STORE, key, h.path, { via: "load", owner: RUNNER });
      return h;
    },
    resumePrompt: (n, body) => `${START.trimEnd()}\n\n---\n\n` +
      `cornerman: this is segment ${n}. The previous segment ran out of context and saved the handover below. ` +
      `Resume from it in this fresh context. Its branch, file and status claims are a snapshot: check them against git before acting.\n\n` +
      body.trim(),
    doneCheck() {
      const d = spawnSync(DONE_CHECK, { shell: true, cwd: REPO, env: env(), encoding: "utf8", windowsHide: true });
      const t = `${d.stdout ?? ""}${d.stderr ?? ""}${d.error ? d.error.message : ""}`.trim();
      return { cmd: DONE_CHECK, code: d.status ?? 1, output: t.length > 2000 ? `[earlier output cut]\n${t.slice(-2000)}` : t };
    },
    unfinishedPrompt: (n, check) => `${START.trimEnd()}\n\n---\n\n` +
      `cornerman: this is segment ${n}. The previous segment ended its turn without finishing the task and without saving a handover. ` +
      `The done check (\`${check.cmd}\`) failed with exit ${check.code}. Its output is below. ` +
      `Check git for what is already done, then carry on with the rest of the task.\n\n` +
      (check.output ? check.output : "(the check printed nothing)"),
  };
}

// --- park and score ----------------------------------------------------------------------
function park() {
  if (readFileSync(join(LIVE, "fork-name.txt"), "utf8").trim() !== name) throw new Error(`the live fork is not ${name}`);
  if (existsSync(LOCK)) throw new Error("a run holds the lock");
  // The parent transcript runs on past cp44 (pilot 3's own cp44-80); left in projects/ the
  // token timeline would count it as this run's work.
  // Folder first: a rename fails (EPERM) while any process holds a file inside it, and doing the
  // transcript first left r2 half-parked.
  mkdirSync(FORK_PARK, { recursive: true });
  const to = join(FORK_PARK, name);
  renameSync(LIVE, to);
  const tr = join(to, "home", ".claude", "projects", PROJECT_KEY);
  mkdirSync(join(to, "out", "parent-transcript"), { recursive: true });
  renameSync(join(tr, `${PARENT_SID}.jsonl`), join(to, "out", "parent-transcript", `${PARENT_SID}.jsonl`));
  console.log(`parked at ${join(FORK_PARK, name)}`);
}

function score() {
  const out = join(ROOT, `score-${Date.now()}`);
  const r = spawnSync(process.execPath, [join(TASK, "tools", "score-run.mjs"), "--run", RUN, "--repo", REPO, "--out", out,
    "--transcripts", join(CONFIG, "projects"), "--json", join(ROOT, "score.json"), "--k", String(FORK_CP + 1)], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`score-run exit ${r.status}`);
  const j = JSON.parse(readFileSync(join(ROOT, "score.json"), "utf8"));
  const log = existsSync(join(OUT, "events.log")) ? readFileSync(join(OUT, "events.log"), "utf8") : "";
  j.harness = {
    fork: JSON.parse(readFileSync(join(OUT, "fork.json"), "utf8")),
    invalid: existsSync(join(OUT, "INVALID")) ? readFileSync(join(OUT, "INVALID"), "utf8").trim() : null,
    limitWaits: (log.match(/usage limit/g) || []).length,
    resumeTurns: (log.match(/segment \d+ start \(resume /g) || []).length,
    topup: (/top-up OK: context (\d+)/.exec(log) || [])[1] ?? null,
    compact: (/compact OK: (\d+) -> (\d+)/.exec(log) || []).slice(1).map(Number),
    clears: (log.match(/start \(clear: handover /g) || []).length,
    clearsWithoutHandover: (log.match(/start \(clear: no handover/g) || []).length,
    cost: Number((/cost ([\d.]+) \(\d+ sessions\)/.exec(log) || [])[1] ?? NaN),
    claudeCode: CLI_VERSION,
  };
  writeFileSync(join(ROOT, "score.json"), JSON.stringify(j, null, 2));
  console.log(`harness: ${JSON.stringify({ ...j.harness, fork: undefined })}`);
}

await ({ setup, verify, run, park, score }[cmd] || (() => { throw new Error("cmd: setup | verify | run | park | score"); }))();
