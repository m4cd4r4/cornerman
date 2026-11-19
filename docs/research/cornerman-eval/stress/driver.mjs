#!/usr/bin/env node
// Stress test trial driver (STRESS-TEST-DESIGN.md, step 2). Plays the user in the real Claude Code
// terminal app (tmux) inside the cornerman-eval container, as test1/driver.mjs does, with the plan
// from plants.mjs: plants by class, W read-heavy work turns (the same in every arm), a filler
// standing rule after each one, then 28 probes, each scored by its checker. Writes /out/result.json.
//   node /stress/driver.mjs --arm full|compact|hybrid|cm|floor --seed N [--work 50] [--window 100000]
//        [--nudge-at 68000] [--clear-at 68000] [--force K] [--short] [--model sonnet] [--set dev]
// Arms:  full     no clear, no compaction (--autocompact 1000000; a compaction here is flagged)
//        compact  native auto-compact at --window, no plugin
//        hybrid   the same plus the rig/hybrid hooks (cornerman cloned for its lib only)
//        cm       cornerman installed by the entrypoint (CM_INSTALL=1), nudge at --nudge-at, and
//                 `/relay unlimited` typed first: the relay's default budget is 3 clears
//        floor    no plugin; `/clear` typed after any turn that ends at or above --clear-at tokens
// --short is the floor variant check: plants, 4 work turns, no fillers, one `/clear`, probes.
// Mounts: /test1 /rig /stress /reading (read only), /out.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { plan, resolveChoice, verdictOk } from "./plants.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = dirname(HERE);
const arg = (n, d) => { const i = process.argv.indexOf(n); return i < 0 ? d : process.argv[i + 1]; };
const has = (n) => process.argv.includes(n);
const ARM = arg("--arm", "full"), SEED = Number(arg("--seed", "101")), MODEL = arg("--model", "sonnet"), SET = arg("--set", "dev");
const SHORT = has("--short"), FORCE = has("--force") ? Number(arg("--force")) : null;
const W = Number(arg("--work", SHORT ? "4" : "50")), PER_TURN = Number(arg("--per-turn", "6"));
const WINDOW = arg("--window", "100000"), NUDGE = Number(arg("--nudge-at", "68000")), CLEAR_AT = Number(arg("--clear-at", "68000"));
const OUT = arg("--out", "/out"), WORK = "/work", IDLE_MS = Number(arg("--idle-ms", "15000")), TURN_MAX_MS = 20 * 60_000;
const PROJ = join(homedir(), ".claude", "projects"), STOPS = "/tmp/stops";
const READING = arg("--reading", "/reading"), OPS_DIR = "/tmp/ledger-ops/topics", BIN = join(homedir(), "bin");
const HYBRID = join(ROOT, "rig", "hybrid"), STORE = join(OUT, "hybrid"), CM_SRC = join(homedir(), "cornerman-src");

const log = (m) => { const l = `${new Date().toISOString()} ${m}`; console.log(l); writeFileSync(join(OUT, "driver.log"), l + "\n", { flag: "a" }); };
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", ...opts });
const tmux = (...a) => spawnSync("tmux", a, { encoding: "utf8" }).stdout ?? "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lines = (p) => (existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean) : []);
const parse = (l) => { try { return JSON.parse(l); } catch { return null; } };

function transcripts() {
  if (!existsSync(PROJ)) return [];
  return readdirSync(PROJ).flatMap((d) => readdirSync(join(PROJ, d)).filter((f) => f.endsWith(".jsonl")).map((f) => join(PROJ, d, f)))
    .map((p) => ({ p, t: statSync(p).mtimeMs, s: statSync(p).size })).sort((a, b) => a.t - b.t);
}
const newest = () => transcripts().at(-1);
const sessions = () => transcripts().length;
const entriesOf = (p) => lines(p).map(parse).filter(Boolean);
const allEntries = () => transcripts().flatMap((t) => entriesOf(t.p));
const boundaries = () => allEntries().filter((e) => e.subtype === "compact_boundary");
const summaries = () => allEntries().filter((e) => e.isCompactSummary).map((e) => ({ at: e.timestamp ?? "", text: textOf(e.message?.content) }));
const textOf = (c) => (typeof c === "string" ? c : (c || []).filter((p) => p.type === "text").map((p) => p.text).join("\n"));
const typed = (e) => e.type === "user" && (typeof e.message?.content === "string" || (Array.isArray(e.message?.content) && e.message.content.some((p) => p.type === "text")));
// Everything in the newest transcript since the user's last typed message.
function sinceLastSay() {
  const es = newest() ? entriesOf(newest().p) : [];
  return es.slice(es.findLastIndex(typed) + 1);
}
const replyText = () => sinceLastSay().filter((e) => e.type === "assistant").map((e) => textOf(e.message?.content)).filter(Boolean).join("\n");
function context() {
  const u = (newest() ? entriesOf(newest().p) : []).filter((e) => e.type === "assistant" && e.message?.usage && !e.isSidechain).at(-1)?.message.usage;
  return u ? (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) : 0;
}
const memoryFiles = () => (existsSync(PROJ) ? readdirSync(PROJ).flatMap((d) => { const m = join(PROJ, d, "memory"); return existsSync(m) ? readdirSync(m).map((f) => join(d, "memory", f)) : []; }) : []);

// Turn ends come from a Stop hook (one line per Stop in STOPS), as in test1/driver.mjs.
const stopCount = () => lines(STOPS).length;
let stopsAtSay = 0;
async function waitIdle(label, { noStop = false } = {}) {
  const start = Date.now();
  let quietSince = null, lastSig = "";
  while (Date.now() - start < TURN_MAX_MS) {
    await sleep(2000);
    const screen = tmux("capture-pane", "-p", "-t", "t");
    if (/Enter to select · [^\n]*to navigate/.test(screen)) { log(`CARD during ${label}: cancelled with Esc`); tmux("send-keys", "-t", "t", "Escape"); noStop = true; quietSince = null; continue; }
    const n = newest();
    const sig = `${n?.p}:${n?.s}:${stopCount()}`;
    const busy = (!noStop && stopCount() <= stopsAtSay) || /esc to interrupt|… \(\d+s/i.test(screen) || sig !== lastSig;
    lastSig = sig;
    if (busy) quietSince = null;
    else if (!quietSince) quietSince = Date.now();
    else if (Date.now() - quietSince >= IDLE_MS) return true;
  }
  log(`TIMEOUT waiting for idle after ${label}`);
  return false;
}
function type(text, label) {
  writeFileSync("/tmp/say.txt", text);
  tmux("load-buffer", "/tmp/say.txt"); tmux("paste-buffer", "-t", "t");
  spawnSync("sleep", ["0.6"]);
  tmux("send-keys", "-t", "t", "Enter");
  log(`SAY [${label}] ${text.slice(0, 100).replace(/\n/g, " ")}`);
}
const turns = [];
async function say(text, label, opts) {
  stopsAtSay = stopCount();
  type(text, label);
  const ok = await waitIdle(label, opts);
  turns.push({ label, at: new Date().toISOString(), context: context(), sessions: sessions(), boundaries: boundaries().length, ok });
  // floor: a plain /clear wherever the other arms would compact or hand over.
  if (ARM === "floor" && !SHORT && !opts?.noClear && context() >= CLEAR_AT) await clear(label);
  return ok;
}
let clears = 0;
async function clear(after) {
  stopsAtSay = stopCount();
  type("/clear", `clear after ${after}`);
  await waitIdle("clear", { noStop: true });
  clears++;
}

// Work turns: the reading corpus, PER_TURN files a turn, in the order of its index file.
const reading = existsSync(join(READING, "index.txt")) ? lines(join(READING, "index.txt")).map((f) => join(READING, f)) : [];
let readAt = 0;
function workTurn() {
  const batch = reading.slice(readAt, readAt + PER_TURN);
  readAt += PER_TURN;
  if (batch.length < PER_TURN) throw new Error(`out of reading at ${readAt} (${reading.length} files for ${W} turns of ${PER_TURN})`);
  return `Next batch of reading for the ledger docs: read each of these files one at a time with the Read tool and add one line per file to docs/reading-notes.md saying what in it could matter for ledger and why: ${batch.join(", ")}. Commit only docs/reading-notes.md when the batch is done.`;
}

// Probe baselines live in a shadow repo the agent never sees (test1/driver.mjs, smoke 2026-11-16).
const SHADOW = { GIT_DIR: "/tmp/snap.git", GIT_WORK_TREE: WORK };
const snap = (...a) => sh("git", ["-c", "user.email=s@s", "-c", "user.name=s", ...a], { env: { ...process.env, ...SHADOW } }).trim();
function snapshot() {
  if (!existsSync(SHADOW.GIT_DIR)) snap("init", "-q");
  snap("add", "-A");
  snap("commit", "-q", "--allow-empty", "-m", "snap");
  return snap("rev-parse", "HEAD");
}
function runChecker(fact, baseline) {
  const factFile = `/tmp/fact-${fact.id}.json`;
  writeFileSync(factFile, JSON.stringify(fact));
  const r = spawnSync("node", [join(ROOT, fact.check), WORK, factFile], { encoding: "utf8", env: { ...process.env, ...SHADOW, BASELINE: baseline, TRANSCRIPT: newest()?.p ?? "" }, timeout: 120_000 });
  return parse(r.stdout.trim().split("\n").at(-1)) ?? { result: "checker-error", detail: (r.stderr || r.stdout || "").slice(0, 400) };
}
// A probe must not be answerable from the repo: files in /work where one line holds the whole fact.
function leaks(fact) {
  if (!fact.written?.length) return [];
  const res = fact.written.map((re) => new RegExp(re, "i"));
  return snap("ls-files").split("\n").filter(Boolean).filter((f) => {
    try { return readFileSync(join(WORK, f), "utf8").split("\n").some((l) => res.every((re) => re.test(l))); } catch { return false; }
  });
}
function handovers() {
  const dir = join(homedir(), ".cornerman", "handovers");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
    .map((h) => ({ at: String(h.createdAt), text: `${h.title ?? ""}\n${h.body ?? ""}` })).sort((a, b) => a.at.localeCompare(b.at));
}
// Carried: per handover (cm) or compaction summary (compact, hybrid) made after the fact's last plant.
function carried(fact, plantedAt) {
  if (!fact.written?.length || !["cm", "compact", "hybrid"].includes(ARM)) return null;
  const docs = (ARM === "cm" ? handovers() : summaries()).filter((d) => d.at > (plantedAt ?? ""));
  const all = (res, t) => res.every((re) => new RegExp(re, "i").test(t)), any = (res, t) => res.some((re) => new RegExp(re, "i").test(t));
  return { written: docs.map((d) => all(fact.written, d.text)), stale: fact.absent?.length ? docs.map((d) => any(fact.absent, d.text)) : null };
}

function setup() {
  mkdirSync(OUT, { recursive: true });
  cpSync(join(ROOT, "test1", "fixture"), WORK, { recursive: true });
  cpSync(join(HERE, "fixture-overlay"), WORK, { recursive: true });
  sh("git", ["init", "-q", WORK]);
  sh("git", ["config", "--global", "user.email", "dev@example.com"]);
  sh("git", ["config", "--global", "user.name", "Dev"]);
  sh("git", ["-C", WORK, "add", "-A"]); sh("git", ["-C", WORK, "commit", "-qm", "ledger baseline"]);
  // ledger-ops on the PATH; its topics sit outside /work and are deleted after one use.
  mkdirSync(OPS_DIR, { recursive: true }); mkdirSync(BIN, { recursive: true });
  writeFileSync(join(BIN, "ledger-ops"), `#!/bin/sh\nLEDGER_OPS_DIR=${OPS_DIR} exec node ${join(HERE, "ops", "ledger-ops.mjs")} "$@"\n`, { mode: 0o755 });

  mkdirSync(join(homedir(), ".claude"), { recursive: true });
  const S = join(homedir(), ".claude", "settings.json");
  const settings = existsSync(S) ? JSON.parse(readFileSync(S, "utf8")) : {};
  settings.permissions = { ...(settings.permissions ?? {}), allow: ["Bash", "Read", "Edit", "Write", "Glob", "Grep", "Skill"] };
  const stop = [{ hooks: [{ type: "command", command: `date +%s%N >> ${STOPS}` }] }];
  const hook = (file) => [{ hooks: [{ type: "command", command: `node ${join(HYBRID, file)}` }] }];
  settings.hooks = { ...(settings.hooks ?? {}), Stop: [...(settings.hooks?.Stop ?? []), ...stop] };
  let env = `export CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 PATH=${BIN}:$PATH\n`, flags = "";
  if (ARM === "hybrid") {
    if (!existsSync(CM_SRC)) {
      sh("git", ["clone", "-q", process.env.CM_SOURCE || "https://github.com/m4cd4r4/cornerman", CM_SRC]);
      if (process.env.CM_REF) sh("git", ["-C", CM_SRC, "checkout", "-q", process.env.CM_REF]);
    }
    Object.assign(settings.hooks, { UserPromptSubmit: hook("prompt.mjs"), PreCompact: hook("pre.mjs"), PostCompact: hook("post.mjs"), SessionStart: hook("start.mjs"), PostToolUse: hook("deliver.mjs") });
    env += `export HYBRID_STORE=${STORE} CM_LIB=${join(CM_SRC, "plugin", "scripts", "lib")}\n`;
  }
  if (ARM === "cm") env += `export CORNERMAN_NUDGE_AT=${NUDGE}\n`;
  if (ARM === "compact" || ARM === "hybrid") flags = ` --autocompact ${WINDOW}`;
  if (ARM === "full") flags = " --autocompact 1000000";
  settings.autoMemoryEnabled = false;
  writeFileSync(S, JSON.stringify(settings, null, 1));
  writeFileSync("/tmp/run-claude.sh", `${env}cd ${WORK}\nclaude --model ${MODEL}${flags}\necho CLAUDE-EXITED $?\nsleep 3600\n`);
}

async function main() {
  setup();
  const { DEV } = await import("./set-dev.mjs");
  const set = { dev: DEV }[SET];
  const P = plan(SEED, set, { force: FORCE });
  const facts = new Map(P.facts.map((f) => [f.id, f])), invalid = {}, plantedAt = {}, plantedIn = {};
  writeFileSync(join(OUT, "plan.json"), JSON.stringify(P, null, 1));
  if (reading.length < W * PER_TURN) throw new Error(`reading corpus has ${reading.length} files, ${W * PER_TURN} needed`);

  tmux("new-session", "-d", "-s", "t", "-x", "200", "-y", "50", "bash /tmp/run-claude.sh");
  await sleep(10_000);
  if (ARM === "cm") await say("/relay unlimited", "relay", { noStop: true });
  await say("We're working on ledger, a small Node money-ledger library in this folder. I'll give you tasks one at a time. Between tasks I'll pass on notes about the project. Treat them as standing rules and facts for every later task, but don't start work from a note on its own: wait for a task. Start by reading README.md and listing the source files.", "brief");

  const topic = (s) => join(OPS_DIR, s.topic + ".txt");
  async function deliver(s) {
    const f = facts.get(s.factId), tag = `${s.kind}:${f.id}`;
    if (s.kind === "note" || s.kind === "task") await say(s.text, tag);
    else if (s.kind === "options") {
      await say(s.ask, tag);
      const done = resolveChoice(f, replyText());
      if (!done) { invalid[f.id] = "options not readable: " + replyText().slice(0, 300); log(`PLANT INVALID ${f.id}`); return; }
      facts.set(f.id, done);
      log(`CHOICE ${f.id}: ${JSON.stringify(done.resolved)}`);
      await say(s.pickText, `pick:${f.id}`);
    } else if (s.kind === "ops" || s.kind === "survey") {
      writeFileSync(topic(s), s.body);
      await say(s.kind === "ops" ? s.text : s.ask, tag);
      const ran = JSON.stringify(sinceLastSay()).includes(s.body.split("\n")[0]);
      const reply = replyText();
      rmSync(topic(s), { force: true });
      if (!ran) { invalid[f.id] = "ledger-ops output not in the turn"; log(`PLANT INVALID ${f.id}`); return; }
      if (s.kind === "survey") {
        if (!verdictOk(s, reply)) { invalid[f.id] = "verdict was not " + s.verdict + ": " + reply.slice(0, 200); log(`PLANT INVALID ${f.id}`); return; }
        await say(s.confirm, `accept:${f.id}`);
      }
    }
    plantedAt[f.id] = new Date().toISOString(); plantedIn[f.id] = sessions() + boundaries().length;
  }

  const due = (lo, hi) => P.steps.filter((s) => s.at >= lo && s.at < hi);
  for (const s of P.steps.filter((x) => x.at === 0)) await deliver(s);
  for (let w = 0; w < W; w++) {
    const now = due(w === 0 ? Number.MIN_VALUE : w / W, (w + 1) / W);
    for (const s of now.filter((x) => x.kind !== "midturn")) await deliver(s);
    const mid = now.filter((x) => x.kind === "midturn");
    if (mid.length) {
      // Typed while the work turn is running (class G, third fact).
      stopsAtSay = stopCount();
      type(workTurn(), `work:${w}`);
      for (const s of mid) { await sleep(s.delayMs); type(s.text, `midturn:${s.factId}`); plantedAt[s.factId] = new Date().toISOString(); plantedIn[s.factId] = sessions() + boundaries().length; }
      const ok = await waitIdle(`work ${w}`);
      turns.push({ label: `work:${w}`, at: new Date().toISOString(), context: context(), sessions: sessions(), boundaries: boundaries().length, ok, midturn: true });
    } else await say(workTurn(), `work:${w}`);
    if (!SHORT && P.fillers[w]) await say(P.fillers[w], `filler:${w}`);
  }
  if (SHORT) await clear("plants");
  const events = sessions() + boundaries().length;
  log(`work turns ${W}, sessions ${sessions()}, compactions ${boundaries().length}, clears typed ${clears}, invalid plants ${Object.keys(invalid).length}`);

  const results = [];
  for (const id of P.probes) {
    const f = facts.get(id);
    if (invalid[id]) { results.push({ cls: f.cls, id, acted: "plant-invalid", detail: invalid[id] }); continue; }
    const leak = leaks(f), baseline = snapshot(), before = sessions() + boundaries().length;
    await say(f.probe, `probe:${id}`, { noClear: true });
    const acted = runChecker(f, baseline);
    results.push({ cls: f.cls, type: f.type, id, variant: f.variant, acted: acted.result, detail: acted.detail, leak, eventsCrossed: events - (plantedIn[id] ?? events), eventDuringProbe: sessions() + boundaries().length > before, ...carried(f, plantedAt[id]) });
    log(`PROBE ${id} ${acted.result} ${acted.detail ?? ""}${leak.length ? " LEAK " + leak.join(",") : ""}`);
  }

  const b = boundaries().map((x) => ({ trigger: x.compactMetadata?.trigger, preTokens: x.compactMetadata?.preTokens, postTokens: x.compactMetadata?.postTokens }));
  writeFileSync(join(OUT, "result.json"), JSON.stringify({
    arm: ARM, seed: SEED, set: SET, force: FORCE, short: SHORT, model: MODEL, window: WINDOW, nudge: NUDGE, clearAt: CLEAR_AT, W,
    sessions: sessions(), compactions: b, clearsTyped: clears, handovers: handovers().length, peakContext: Math.max(0, ...turns.map((t) => t.context)),
    fullArmCompacted: ARM === "full" && b.length > 0, memoryFiles: memoryFiles(), invalid, turns, results,
  }, null, 1));
  mkdirSync(join(OUT, "transcripts"), { recursive: true });
  for (const t of transcripts()) cpSync(t.p, join(OUT, "transcripts", t.p.split("/").at(-1)));
  if (existsSync(join(homedir(), ".cornerman"))) cpSync(join(homedir(), ".cornerman"), join(OUT, "cm"), { recursive: true });
  tmux("kill-server");
}

main().catch((e) => { log(`DRIVER ERROR ${e.stack}`); writeFileSync(join(OUT, "error.txt"), String(e.stack)); process.exit(1); });
