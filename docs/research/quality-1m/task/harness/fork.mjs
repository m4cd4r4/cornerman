#!/usr/bin/env node
// fork.mjs: the fill dial (TASK-DESIGN.md, "Fill dial"). Every arm starts from pilot 3's real
// session at the message that commits cp43 and asks the gate for cp44, and differs only in what
// happens to its context there.
//   node fork.mjs setup <name>    build the fork at the live path (US$0)
//   node fork.mjs verify <name>   static checks of the fork, no model call (US$0)
//   node fork.mjs run <name>      run the arm to ALL DONE (takes the lock)
//   node fork.mjs park <name>     move the parent transcript aside, move the fork to FORK_PARK
//   node fork.mjs score <name>    score the parked fork, late segment from cp44
// <name> = fork-<natural|fill900>-sonnet-r<n>. compact / clear / fill700 are designed, not built.
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
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK = resolve(HERE, "..");
const CPS = join(TASK, "checkpoints");
const [cmd, name] = process.argv.slice(2);
const m = /^fork-(natural|fill(\d+))-(sonnet)-r(\d+)$/.exec(name || "");
if (!m) throw new Error("name must be fork-<natural|fill900>-sonnet-r<n>");
const arm = m[1], fillTo = m[2] ? Number(m[2]) * 1000 : null;
const MODEL_ID = "claude-sonnet-5-5";

// The parent: pilot 3, scored and parked.
const PARENT = "I:/Scratch/_q1m-pilot/default-sonnet-r3";
const PARENT_SID = "9f17f65f-b298-4272-877c-a8eb2e286255";
const FORK_MSG = "msg_011Cgy5CiyhMKuLH8UdtZW6i";
const FORK_HEAD = "55ac83d0a688cb1739566a1516b10133ef444c58"; // "cp43: COUNTIF and AVERAGEIF"
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
  writeFileSync(join(OUT, "fork.json"), JSON.stringify(info, null, 2));
  events(`setup ${name}: fork of ${PARENT_SID} at ${FORK_MSG}, repo at ${FORK_HEAD.slice(0, 7)}, gate cp${FORK_CP}, claude-code ${cli}${fillTo ? `, top-up ${info.topupChars} chars (~${info.topupTokensEst} tokens) for ${fillTo}` : ""}`);
}

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
  const at = tr.findIndex((l) => l.includes(`"id":"${FORK_MSG}"`) && l.includes("node gate.mjs next"));
  ok("transcript has the fork message (Bash: commit cp43 && gate next)", at !== -1, `line ${at + 1}`);
  const sid = (l) => { try { return JSON.parse(l).sessionId; } catch { return null; } };
  ok("transcript session id", sid(tr[0]) === PARENT_SID || sid(tr[1]) === PARENT_SID);
  ok("transcript paths point at the live fork", tr[at].includes("I:\\\\Scratch\\\\_q1m\\\\default-sonnet-r3\\\\repo") || tr.slice(0, at).some((l) => l.includes("_q1m\\\\default-sonnet-r3\\\\repo")));
  if (fillTo) {
    const f = JSON.parse(readFileSync(join(OUT, "fork.json"), "utf8"));
    ok("top-up file matches its recorded hash", sha(readFileSync(join(ROOT, "topup.txt"), "utf8")) === f.topupSha, `${f.topupChars} chars, ~${f.topupTokensEst} tokens, ${f.undiciFiles} undici files`);
    ok("top-up has no spreadsheet words in the undici part", !/spreadsheet|formula|COUNTIF|#REF!|#DIV\/0|workbook/i.test(readFileSync(join(ROOT, "topup.txt"), "utf8").split("=== end of undici ===")[0].slice(600)));
  }
  const bad = checks.filter((c) => !c.pass).length;
  events(`verify ${name}: ${checks.length - bad}/${checks.length} checks pass`);
  if (bad) process.exit(1);
}

// --- run ---------------------------------------------------------------------------------
const gateStatus = () => { try { return JSON.parse(readFileSync(join(RUN, "gate-state.json"), "utf8")); } catch { return { current: 0 }; } };
const LIMIT = /usage limit|rate limit|limit reached|resets? (at|in)|overloaded|529|5-hour limit|weekly limit/i;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

// One claude process. Resolves { code, limited, cost, session, ctx } where ctx is the context
// size of the last assistant message (the top-up check reads it).
function claudeOnce(n, args, input) {
  return new Promise((done) => {
    const out = join(OUT, `stream-${String(n).padStart(2, "0")}.jsonl`);
    const child = spawn(CLAUDE, args, { cwd: REPO, env: env(), stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let tail = "", buf = "", session = null, ctx = null;
    child.stdout.on("data", (b) => {
      appendFileSync(out, b);
      tail = (tail + b.toString()).slice(-20000);
      const lines = (buf + b.toString()).split("\n");
      buf = lines.pop();
      for (const l of lines) {
        try {
          const j = JSON.parse(l);
          if (j.session_id && !session) session = j.session_id;
          const u = j.type === "assistant" && j.message?.usage;
          if (u) ctx = u.input_tokens + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
        } catch {}
      }
    });
    child.stderr.on("data", (b) => { appendFileSync(join(OUT, "stderr.log"), b); tail = (tail + b.toString()).slice(-20000); });
    child.stdin.end(input);
    child.on("close", (code) => {
      const res = tail.split("\n").reverse().find((l) => l.includes("\"type\":\"result\""));
      let limited = false, cost = null;
      try { const j = JSON.parse(res); cost = j.total_cost_usd ?? null; limited = !!j.is_error && LIMIT.test(String(j.result || "")); } catch { limited = LIMIT.test(tail.slice(-3000)); }
      done({ code, limited, cost, session, ctx });
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
  events(`run ${name}: gate up at cp ${gateStatus().current}, model ${MODEL_ID}, arm ${arm}, claude-code ${cli}`);
  writeFileSync(join(OUT, "started.txt"), new Date().toISOString() + "\n");
  let total = 0;
  try {
    // Segment 1 forks. Until it has produced a session id the fork is retried after a limit wait.
    let sid = null, n = 0, waits = 0, limitedAfterFork = false;
    const forkArgs = [...CLAUDE_ARGS, "--resume", PARENT_SID, "--resume-session-at", FORK_MSG, "--fork-session"];
    while (!sid) {
      n++;
      const first = fillTo ? readFileSync(join(ROOT, "topup.txt"), "utf8") : CONTINUE;
      events(`segment ${n} start (fork of ${PARENT_SID} at ${FORK_MSG}, ${fillTo ? "top-up turn" : "continue"}) at cp ${gateStatus().current}`);
      const r = await claudeOnce(n, forkArgs, first);
      total += r.cost || 0;
      events(`segment ${n} exit ${r.code} cost ${r.cost} limited ${r.limited} session ${r.session} context ${r.ctx} cp ${gateStatus().current}`);
      if (r.limited && !r.ctx) { waits++; events(`usage limit before the fork took: wait 20 min (wait ${waits})`); await sleep(20 * 60 * 1000); continue; }
      if (!r.session) throw new Error("fork produced no session id");
      sid = r.session;
      limitedAfterFork = r.limited;
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
    }
    // Then the same loop as arm.mjs runSession, on the forked session.
    let stale = 0, last = gateStatus().current;
    // natural: segment 1 already carried CONTINUE, so this only runs if it ended early.
    // fill: segment 1 was the top-up turn, so the first resume carries CONTINUE.
    if (limitedAfterFork) { waits++; events(`usage limit: wait 20 min (wait ${waits})`); await sleep(20 * 60 * 1000); }
    while (!gateStatus().finished) {
      n++;
      events(`segment ${n} start (resume ${sid}) at cp ${gateStatus().current}`);
      const r = await claudeOnce(n, [...CLAUDE_ARGS, "--resume", sid], CONTINUE);
      total += r.cost || 0;
      const now = gateStatus().current;
      events(`segment ${n} exit ${r.code} cost ${r.cost} limited ${r.limited} context ${r.ctx} cp ${now}`);
      if (gateStatus().finished) break;
      if (r.limited) { waits++; events(`usage limit: wait 20 min (wait ${waits})`); await sleep(20 * 60 * 1000); continue; }
      stale = now > last ? 0 : stale + 1;
      last = now;
      if (stale >= 3) { events("stopped: 3 resumes in a row with no checkpoint progress"); break; }
    }
  } finally {
    rmSync(LOCK, { recursive: true, force: true });
    gate.kill();
    const s = gateStatus();
    writeFileSync(join(OUT, "ended.txt"), `${new Date().toISOString()} cp ${s.current} finished ${!!s.finished} cost ${total.toFixed(2)}\n`);
    events(`run ${name}: ended at cp ${s.current}, finished ${!!s.finished}, cost ${total.toFixed(2)}`);
  }
}

// --- park and score ----------------------------------------------------------------------
function park() {
  if (readFileSync(join(LIVE, "fork-name.txt"), "utf8").trim() !== name) throw new Error(`the live fork is not ${name}`);
  if (existsSync(LOCK)) throw new Error("a run holds the lock");
  // The parent transcript runs on past cp44 (pilot 3's own cp44-80); left in projects/ the
  // token timeline would count it as this run's work.
  mkdirSync(join(OUT, "parent-transcript"), { recursive: true });
  renameSync(join(TRANSCRIPTS, `${PARENT_SID}.jsonl`), join(OUT, "parent-transcript", `${PARENT_SID}.jsonl`));
  mkdirSync(FORK_PARK, { recursive: true });
  renameSync(LIVE, join(FORK_PARK, name));
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
    claudeCode: CLI_VERSION,
  };
  writeFileSync(join(ROOT, "score.json"), JSON.stringify(j, null, 2));
  console.log(`harness: ${JSON.stringify({ ...j.harness, fork: undefined })}`);
}

await ({ setup, verify, run, park, score }[cmd] || (() => { throw new Error("cmd: setup | verify | run | park | score"); }))();
