#!/usr/bin/env node
// Stress test trial driver (STRESS-TEST-DESIGN.md, step 2). Plays the user in the real Claude Code
// terminal app (tmux) inside the cornerman-eval container, as test1/driver.mjs does, with the plan
// from plants.mjs: plants by class, W read-heavy work turns (the same in every arm), a filler
// standing rule after each one, then 28 probes, each scored by its checker. Writes /out/result.json.
//   node /stress/driver.mjs --arm full|compact|hybrid|cm|floor --seed N [--work 50] [--window 100000]
//        [--nudge-at 68000] [--clear-at 68000] [--force K] [--short] [--model sonnet] [--set dev|held]
// Arms:  full     no clear, no compaction (--autocompact 1000000; a compaction here is flagged)
//        compact  native auto-compact at --window, no plugin
//        hybrid   the same plus the rig/hybrid hooks (cornerman cloned for its lib only)
//        cm       cornerman installed by the entrypoint (CM_INSTALL=1), nudge at --nudge-at, and
//                 `/relay unlimited` typed first: the relay's default budget is 3 clears
//        floor    no plugin; `/clear` typed after any whole plant, work turn or filler that ends at or
//                 above --clear-at tokens
// --short is the floor variant check: plants, 4 work turns, no fillers, one `/clear`, probes.
// Mounts: /test1 /rig /stress /reading (read only), /out.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { plan, resolveChoice, verdictOk, lastText, ORDINAL } from "./plants.mjs";

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
// A message the driver typed. A compaction summary, a hook or command entry and the line the cornerman
// relay types after its own /clear are user entries too, and none of them is the driver speaking.
const RELOAD = "Continue from the cornerman handover that was just loaded.";
const typed = (e) => e.type === "user" && !e.isCompactSummary && !e.isMeta && (typeof e.message?.content === "string" || (Array.isArray(e.message?.content) && e.message.content.some((p) => p.type === "text"))) && !textOf(e.message.content).startsWith(RELOAD);
// Everything since the message the driver just sent, across all transcripts: a clear or a relay
// between the message and the reply puts the reply in a newer transcript than the message.
let lastSaid = "";
function sinceLastSay() {
  const es = allEntries(), key = lastSaid.split("\n")[0].slice(0, 60);
  let i = key ? es.findLastIndex((e) => typed(e) && textOf(e.message.content).includes(key)) : -1;
  if (i < 0) i = es.findLastIndex(typed);
  return es.slice(i + 1);
}
const replyText = () => sinceLastSay().filter((e) => e.type === "assistant").map((e) => textOf(e.message?.content)).filter(Boolean).join("\n");
// floor: the driver's own clears are counted, because a cleared session has no transcript until its first message.
const eventCount = () => (ARM === "floor" ? 1 + clears : sessions()) + boundaries().length;
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
  lastSaid = text;
  log(`SAY [${label}] ${text.slice(0, 100).replace(/\n/g, " ")}`);
}
const turns = [];
async function say(text, label, opts) {
  stopsAtSay = stopCount();
  type(text, label);
  const ok = await waitIdle(label, opts);
  turns.push({ label, at: new Date().toISOString(), context: context(), sessions: sessions(), boundaries: boundaries().length, ok });
  return ok;
}
let clears = 0;
async function clear(after) {
  stopsAtSay = stopCount();
  type("/clear", `clear after ${after}`);
  await waitIdle("clear", { noStop: true });
  clears++;
}
// floor: a plain /clear wherever the other arms would compact or hand over, but only after a whole
// plant step, work turn or filler, never between the two messages of one plant, and never in the probes.
async function floorClear(after) {
  if (ARM === "floor" && !SHORT && context() >= CLEAR_AT) await clear(after);
}

// Work turns: the reading corpus, PER_TURN files a turn, in the order of its index file.
const reading = existsSync(join(READING, "index.txt")) ? lines(join(READING, "index.txt")).map((f) => join(READING, f)) : [];
let readAt = 0;
function workTurn() {
  const batch = reading.slice(readAt, readAt + PER_TURN);
  readAt += PER_TURN;
  if (batch.length < PER_TURN) throw new Error(`out of reading at ${readAt} (${reading.length} files for ${W} turns of ${PER_TURN})`);
  // The notes are about the files read, never about ledger. Floor runs 1-5 (2026-11-19): asked what in
  // each file "could matter for ledger and why", the agent wrote the planted rules into the notes
  // ("6-attempt cap on bank feed calls"), and the floor then passed those probes from the repo.
  // Whole files, said in the task: in development trial 1 (2026-11-20) the full and cm agents read the
  // first 60 lines of each file and the compact agent read every file whole, 3.5 times the text.
  return `Next batch of reading: read each of these files one at a time with the Read tool, each one whole from its first line to its last (no limit, no offset), and add one line per file to docs/reading-notes.md saying what the file documents: ${batch.join(", ")}. The notes are about the files themselves; ledger's own rules, settings and decisions never go in them. Commit only docs/reading-notes.md when the batch is done.`;
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
  // All transcripts joined, oldest first: a clear or a relay during the probe splits it over two files.
  const all = "/tmp/tx-all.jsonl";
  writeFileSync(all, transcripts().map((t) => readFileSync(t.p, "utf8").replace(/\n*$/, "\n")).join(""));
  const r = spawnSync("node", [join(ROOT, fact.check), WORK, factFile], { encoding: "utf8", env: { ...process.env, ...SHADOW, BASELINE: baseline, TRANSCRIPT: all }, timeout: 120_000 });
  rmSync(factFile, { force: true }); rmSync(all, { force: true });
  return parse(r.stdout.trim().split("\n").at(-1)) ?? { result: "checker-error", detail: (r.stderr || r.stdout || "").slice(0, 400) };
}
// Tool calls that name a place holding the plan, the checkers or the expected values. Flagged, not excluded.
const OFF_LIMITS = /(?<![\w.\/-])\/(stress|test1|out)(?![\w-])|\/tmp\/(fact-|snap\.git|tx-all)/;
function offLimits() {
  return allEntries().filter((e) => e.type === "assistant" && Array.isArray(e.message?.content))
    .flatMap((e) => e.message.content.filter((p) => p.type === "tool_use" && OFF_LIMITS.test(JSON.stringify(p.input ?? {}))).map((p) => ({ at: e.timestamp, tool: p.name, input: JSON.stringify(p.input).slice(0, 200) })));
}
// Reads of a reading file that asked for part of it. Every arm must read the same text (see workTurn).
function limitedReads() {
  return allEntries().filter((e) => e.type === "assistant" && Array.isArray(e.message?.content))
    .flatMap((e) => e.message.content.filter((p) => p.type === "tool_use" && p.name === "Read" && String(p.input?.file_path ?? "").startsWith(READING) && (p.input.limit != null || p.input.offset != null)).map((p) => p.input.file_path));
}
// A probe must not be answerable from the repo: files in /work where one line the agent added holds
// the whole fact. Only lines added since the fixture baseline count: the fixture cannot hold a planted
// fact, and scanning it flagged 14 of 28 probes by chance in floor run 0 (2026-11-19).
let BASE = "";
function leaks(fact) {
  if (!fact.written?.length) return [];
  const res = fact.written.map((re) => new RegExp(re, "i")), hit = (l) => res.every((re) => re.test(l)), out = new Set();
  let file = "", diff = "";
  try { diff = sh("git", ["-C", WORK, "diff", "-U0", BASE], { maxBuffer: 256 * 1024 * 1024 }); } catch (e) { log(`LEAK SCAN FAILED ${fact.id}: ${String(e.message).slice(0, 120)}`); }
  for (const l of diff.split("\n")) {
    if (l.startsWith("+++ ")) file = l.slice(6);
    else if (l.startsWith("+") && hit(l.slice(1))) out.add(file);
  }
  for (const f of sh("git", ["-C", WORK, "ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean)) {
    try { if (readFileSync(join(WORK, f), "utf8").split("\n").some(hit)) out.add(f); } catch { /* unreadable: not a leak */ }
  }
  return [...out];
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
  BASE = sh("git", ["-C", WORK, "rev-parse", "HEAD"]).trim();
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

// plan.json holds every expected value and the agent can read /out, so it is written when the trial
// ends (or fails), with the class C facts as the run finished them.
let writePlan = () => {};
async function main() {
  setup();
  // The held-out set is loaded only when asked for: a development trial never reads its file.
  if (!["dev", "held"].includes(SET)) throw new Error(`unknown --set ${SET}`);
  const set = SET === "held" ? (await import("./set-held.mjs")).HELD : (await import("./set-dev.mjs")).DEV;
  const P = plan(SEED, set, { force: FORCE });
  const facts = new Map(P.facts.map((f) => [f.id, f])), invalid = {}, plantedAt = {}, plantedIn = {}, split = {};
  writePlan = () => writeFileSync(join(OUT, "plan.json"), JSON.stringify({ ...P, facts: [...facts.values()] }, null, 1));
  if (reading.length < W * PER_TURN) throw new Error(`reading corpus has ${reading.length} files, ${W * PER_TURN} needed`);

  tmux("new-session", "-d", "-s", "t", "-x", "200", "-y", "50", "bash /tmp/run-claude.sh");
  await sleep(10_000);
  if (ARM === "cm") await say("/relay unlimited", "relay", { noStop: true });
  await say("We're working on ledger, a small Node money-ledger library in this folder. I'll give you tasks one at a time. Between tasks I'll pass on notes about the project. Treat them as standing rules and facts for every later task, but don't start work from a note on its own: wait for a task. Start by reading README.md and listing the source files.", "brief");

  const topic = (s) => join(OPS_DIR, s.topic + ".txt");
  async function deliver(s) {
    const f = facts.get(s.factId), tag = `${s.kind}:${f.id}`;
    // Set before sending: a handover or summary made during the plant's own turn comes after the plant.
    plantedAt[f.id] = new Date().toISOString(); plantedIn[f.id] = eventCount();
    // The second message of a class C or E plant. A clear or compaction since the first one is flagged.
    const second = async (text, label) => {
      if (eventCount() !== plantedIn[f.id]) { split[f.id] = true; log(`PLANT SPLIT ${f.id}: a clear or compaction between its two messages`); }
      await say(text, label);
    };
    if (s.kind === "note" || s.kind === "task") await say(s.text, tag);
    else if (s.kind === "options") {
      await say(s.ask, tag);
      const done = resolveChoice(f, replyText());
      if (!done) { invalid[f.id] = "options not readable: " + replyText().slice(0, 300); log(`PLANT INVALID ${f.id}`); return; }
      facts.set(f.id, done);
      log(`CHOICE ${f.id}: ${JSON.stringify(done.resolved)}`);
      // Worded from the position the fact was finished with: a choice with a default to avoid picks at run time.
      await second(set.pick(ORDINAL[done.resolved.pick]), `pick:${f.id}`);
    } else if (s.kind === "ops" || s.kind === "survey") {
      writeFileSync(topic(s), s.body);
      await say(s.kind === "ops" ? s.text : s.ask, tag);
      const ran = JSON.stringify(sinceLastSay()).includes(s.body.split("\n")[0]);
      // The verdict is read from the last text block: a line said before the tool call is not the verdict.
      const reply = lastText(sinceLastSay());
      rmSync(topic(s), { force: true });
      if (!ran) { invalid[f.id] = "ledger-ops output not in the turn"; log(`PLANT INVALID ${f.id}`); return; }
      if (s.kind === "survey") {
        if (!verdictOk(s, reply)) { invalid[f.id] = "verdict was not " + s.verdict + ": " + reply.slice(0, 200); log(`PLANT INVALID ${f.id}`); return; }
        await second(s.confirm, `accept:${f.id}`);
      }
    }
  }

  const due = (lo, hi) => P.steps.filter((s) => s.at >= lo && s.at < hi);
  const plant = async (s) => { await deliver(s); await floorClear(`plant ${s.factId}`); };
  for (const s of P.steps.filter((x) => x.at === 0)) await plant(s);
  for (let w = 0; w < W; w++) {
    const now = due(w === 0 ? Number.MIN_VALUE : w / W, (w + 1) / W);
    for (const s of now.filter((x) => x.kind !== "midturn")) await plant(s);
    const mid = now.filter((x) => x.kind === "midturn");
    if (mid.length) {
      // Typed while the work turn is running (class G, third fact).
      stopsAtSay = stopCount();
      type(workTurn(), `work:${w}`);
      for (const s of mid) { await sleep(s.delayMs); plantedAt[s.factId] = new Date().toISOString(); plantedIn[s.factId] = eventCount(); type(s.text, `midturn:${s.factId}`); }
      const ok = await waitIdle(`work ${w}`);
      turns.push({ label: `work:${w}`, at: new Date().toISOString(), context: context(), sessions: sessions(), boundaries: boundaries().length, ok, midturn: true });
    } else await say(workTurn(), `work:${w}`);
    await floorClear(`work ${w}`);
    if (!SHORT && P.fillers[w]) { await say(P.fillers[w], `filler:${w}`); await floorClear(`filler ${w}`); }
  }
  if (SHORT) await clear("plants");
  log(`work turns ${W}, sessions ${sessions()}, compactions ${boundaries().length}, clears typed ${clears}, invalid plants ${Object.keys(invalid).length}`);

  const results = [];
  for (const id of P.probes) {
    const f = facts.get(id);
    if (invalid[id]) { results.push({ cls: f.cls, type: f.type, id, variant: f.variant, acted: "plant-invalid", detail: invalid[id] }); continue; }
    // snapshot() first: it creates the shadow repo that leaks() lists files from.
    const baseline = snapshot(), leak = leaks(f), before = eventCount();
    await say(f.probe, `probe:${id}`);
    const acted = runChecker(f, baseline);
    // eventsCrossed is counted to this probe: the compact, hybrid and cm arms go on compacting or clearing during the probes.
    results.push({ cls: f.cls, type: f.type, id, variant: f.variant, acted: acted.result, detail: acted.detail, leak, eventsCrossed: before - (plantedIn[id] ?? before), eventDuringProbe: eventCount() > before, plantSplit: !!split[id], ...carried(f, plantedAt[id]) });
    log(`PROBE ${id} ${acted.result} ${acted.detail ?? ""}${leak.length ? " LEAK " + leak.join(",") : ""}`);
  }

  const off = offLimits();
  if (off.length) log(`OFF LIMITS: ${off.length} tool call(s) named /stress, /test1, /out or a checker file`);
  const limited = limitedReads();
  if (limited.length) log(`LIMITED READS: ${limited.length} read(s) of a reading file with a limit or offset`);
  const b = boundaries().map((x) => ({ trigger: x.compactMetadata?.trigger, preTokens: x.compactMetadata?.preTokens, postTokens: x.compactMetadata?.postTokens }));
  writeFileSync(join(OUT, "result.json"), JSON.stringify({
    arm: ARM, seed: SEED, set: SET, force: FORCE, short: SHORT, model: MODEL, window: WINDOW, nudge: NUDGE, clearAt: CLEAR_AT, W,
    sessions: sessions(), compactions: b, clearsTyped: clears, handovers: handovers().length, peakContext: Math.max(0, ...turns.map((t) => t.context)),
    fullArmCompacted: ARM === "full" && b.length > 0, memoryFiles: memoryFiles(), invalid, split, offLimits: off, perTurn: PER_TURN, limitedReads: limited, turns, results,
  }, null, 1));
  writePlan();
  mkdirSync(join(OUT, "transcripts"), { recursive: true });
  for (const t of transcripts()) cpSync(t.p, join(OUT, "transcripts", t.p.split("/").at(-1)));
  if (existsSync(join(homedir(), ".cornerman"))) cpSync(join(homedir(), ".cornerman"), join(OUT, "cm"), { recursive: true });
  tmux("kill-server");
}

main().catch((e) => { log(`DRIVER ERROR ${e.stack}`); try { writePlan(); } catch {} writeFileSync(join(OUT, "error.txt"), String(e.stack)); process.exit(1); });
