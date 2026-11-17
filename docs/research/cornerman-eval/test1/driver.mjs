#!/usr/bin/env node
// Test 1 trial driver: plays the user in the real Claude Code terminal app (tmux), inside the
// cornerman-eval container. Plants the seed's facts in chat, sends W = 3K+1 read-heavy work turns
// (same in every arm), then sends each probe and runs its checker. Writes /out/result.json.
//   node driver.mjs --arm cm|full|compact --seed N --clears K [--model sonnet] [--nudge-at 35000] [--work W]
// Arms: cm = cornerman installed, relay clears by itself at the nudge; full = no cornerman, no
// clear (the ceiling); compact = no cornerman, `/compact` typed after every --compact-every turns.
// Idle = the screen has not shown "esc to interrupt" and the newest transcript has not grown for
// IDLE_MS. A relay clear starts a new transcript, so idle is only trusted once it holds that long.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf(n); return i < 0 ? d : process.argv[i + 1]; };
const ARM = arg("--arm", "cm"), SEED = Number(arg("--seed", "1")), CLEARS = Number(arg("--clears", "1"));
const MODEL = arg("--model", "sonnet"), NUDGE = Number(arg("--nudge-at", "35000"));
// Equal work in every arm (batch pressure item 1): W work turns, W = 3K + 1, whatever the arm.
const COMPACT_EVERY = Number(arg("--compact-every", "3")), W = Number(arg("--work", String(3 * CLEARS + 1)));
const OUT = arg("--out", "/out"), WORK = "/work", IDLE_MS = Number(arg("--idle-ms", "15000"));
const TURN_MAX_MS = 20 * 60_000;
const PROJ = join(homedir(), ".claude", "projects");
const DOCS = "/usr/local/lib/node_modules/npm/docs/content";
const DOC_DIRS = ["commands", "using-npm", "configuring-npm"];

const log = (m) => { const l = `${new Date().toISOString()} ${m}`; console.log(l); writeFileSync(join(OUT, "driver.log"), l + "\n", { flag: "a" }); };
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", ...opts });
const tmux = (...a) => spawnSync("tmux", a, { encoding: "utf8" }).stdout ?? "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const git = (...a) => sh("git", ["-C", WORK, ...a]).trim();

function transcripts() {
  if (!existsSync(PROJ)) return [];
  return readdirSync(PROJ).flatMap((d) => readdirSync(join(PROJ, d)).filter((f) => f.endsWith(".jsonl")).map((f) => join(PROJ, d, f)))
    .map((p) => ({ p, t: statSync(p).mtimeMs, s: statSync(p).size })).sort((a, b) => a.t - b.t);
}
const newest = () => transcripts().at(-1);
// Any auto-memory file written during the trial (should be none: see autoMemoryEnabled below).
const memoryFiles = () => (existsSync(PROJ) ? readdirSync(PROJ).flatMap((d) => {
  const m = join(PROJ, d, "memory");
  return existsSync(m) ? readdirSync(m).map((f) => join(d, "memory", f)) : [];
}) : []);
const sessions = () => transcripts().length;

// Turn ends come from a Stop hook the driver installs (one line per Stop in STOPS): the screen
// alone misread a long thinking pause as idle (smoke 2026-11-16, probes typed into a busy turn).
const STOPS = "/tmp/stops";
const stopCount = () => (existsSync(STOPS) ? readFileSync(STOPS, "utf8").split("\n").filter(Boolean).length : 0);
let stopsAtSay = 0;

// noStop: the turn ends without a Stop hook, so screen + transcript quiet is trusted on its own.
// True for `/compact` and after the driver cancels a question card with Esc (smoke 2: both waited
// out TURN_MAX). A card is the agent asking; Esc cancels it and the transcript keeps the ask.
async function waitIdle(label, { noStop = false } = {}) {
  const start = Date.now();
  let quietSince = null, lastSig = "";
  while (Date.now() - start < TURN_MAX_MS) {
    await sleep(2000);
    const screen = tmux("capture-pane", "-p", "-t", "t");
    // Footer differs by card: "↑/↓ to navigate" (one question), "Tab/Arrow keys to navigate"
    // (several; smoke round 5 full arm waited out TURN_MAX on one). The pending ask reaches the
    // transcript only once the card resolves, so a missed card also reads as "no ask".
    if (/Enter to select · [^\n]*to navigate/.test(screen)) {
      log(`CARD during ${label}: cancelled with Esc`);
      tmux("send-keys", "-t", "t", "Escape");
      noStop = true; quietSince = null;
      continue;
    }
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

async function say(text, label) {
  stopsAtSay = stopCount();
  writeFileSync("/tmp/say.txt", text);
  tmux("load-buffer", "/tmp/say.txt");
  tmux("paste-buffer", "-t", "t");
  await sleep(600);
  tmux("send-keys", "-t", "t", "Enter");
  log(`SAY [${label}] ${text.slice(0, 100).replace(/\n/g, " ")}`);
}

// Work turns: real reading (npm's own docs, all three folders interleaved so every segment mixes
// them), so context grows on content the agent needs. 83 files in the image, 6 per turn.
const perDir = DOC_DIRS.map((d) => readdirSync(join(DOCS, d)).filter((f) => f.endsWith(".md")).sort().map((f) => join(DOCS, d, f)));
const docFiles = [];
for (let i = 0; perDir.some((l) => i < l.length); i++) for (const l of perDir) if (i < l.length) docFiles.push(l[i]);
let docAt = 0;
function workTurn() {
  const batch = docFiles.slice(docAt, docAt + 6);
  docAt += 6;
  if (batch.length < 6) throw new Error(`out of doc files at ${docAt} (W too large for ${docFiles.length} files)`);
  return `Next batch of reading for the ledger docs: read each of these files one at a time with the Read tool and add one line per file to docs/npm-notes.md saying which npm feature could matter for ledger's release process and why: ${batch.join(", ")}. Commit when the batch is done.`;
}

// Probe baselines live in a shadow repo the agent never sees: commits in /work ("before probe
// ruling-3") were noticed and written into a handover (smoke 2026-11-16), which leaks the test.
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
  const r = spawnSync("node", [join(HERE, fact.check), WORK, factFile], {
    encoding: "utf8", env: { ...process.env, ...SHADOW, BASELINE: baseline, TRANSCRIPT: newest()?.p ?? "" }, timeout: 120_000,
  });
  try { return JSON.parse(r.stdout.trim().split("\n").at(-1)); } catch { return { result: "checker-error", detail: (r.stderr || r.stdout || "").slice(0, 400) }; }
}

function handovers() {
  const dir = join(homedir(), ".cornerman", "handovers");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

const hText = (h) => `${h.title ?? ""}\n${h.body ?? ""}`;
function writtenScore(fact, hs) {
  // Per handover in the chain: every `written` regex matches. A superseded wording that is also
  // still there (the rulings log quotes every ruling, smoke 2026-11-16) is reported in staleScore.
  return hs.map((h) => (fact.written ?? []).every((re) => new RegExp(re, "i").test(hText(h))));
}
const staleScore = (fact, hs) => (fact.absent?.length ? hs.map((h) => fact.absent.some((re) => new RegExp(re, "i").test(hText(h)))) : null);

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { pick } = await import(join(HERE, "facts.mjs"));
  const facts = pick(SEED);
  writeFileSync(join(OUT, "facts.json"), JSON.stringify(facts, null, 1));

  cpSync(join(HERE, "fixture"), WORK, { recursive: true });
  sh("git", ["init", "-q", WORK]);
  git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "ledger baseline");
  sh("git", ["config", "--global", "user.email", "dev@example.com"]);
  sh("git", ["config", "--global", "user.name", "Dev"]);

  mkdirSync(join(homedir(), ".claude"), { recursive: true });
  const S = join(homedir(), ".claude", "settings.json");
  const settings = existsSync(S) ? JSON.parse(readFileSync(S, "utf8")) : {};
  settings.permissions = { ...(settings.permissions ?? {}), allow: ["Bash", "Read", "Edit", "Write", "Glob", "Grep", "Skill"] };
  settings.hooks = { ...(settings.hooks ?? {}), Stop: [...(settings.hooks?.Stop ?? []), { hooks: [{ type: "command", command: `date +%s%N >> ${STOPS}` }] }] };
  // Auto-memory off in every arm (Macdara 2026-11-16 21:48 AWST): its notes survive a clear, so
  // acted-on would measure cornerman + auto-memory. Both switches; memoryFiles in result.json proves it.
  settings.autoMemoryEnabled = false;
  writeFileSync(S, JSON.stringify(settings, null, 1));

  writeFileSync("/tmp/run-claude.sh", `export CORNERMAN_NUDGE_AT=${NUDGE} CLAUDE_CODE_DISABLE_AUTO_MEMORY=1\ncd ${WORK}\nclaude --model ${MODEL}\necho CLAUDE-EXITED $?\nsleep 3600\n`);
  tmux("new-session", "-d", "-s", "t", "-x", "200", "-y", "50", "bash /tmp/run-claude.sh");
  await sleep(10_000);

  const early = facts.flatMap((f) => f.plant.filter((p) => p.phase === "early").map((p) => ({ f, p })));
  const late = facts.flatMap((f) => f.plant.filter((p) => p.phase === "late").map((p) => ({ f, p })));

  // Opening brief, then the early plants one per turn, each with a work turn between.
  await say("We're working on ledger, a small Node money-ledger library in this folder. I'll give you tasks one at a time. Between tasks I'll pass on notes about the project. Treat them as standing rules and facts for every later task, but don't start work from a note on its own: wait for a task. Start by reading README.md and listing the source files.", "brief");
  await waitIdle("brief");
  // Every plant records the session it landed in, so each fact's probe can say how many clears
  // it actually crossed (a clear can land in the middle of the plants).
  const plantedIn = {}, plantedAt = {};
  const plant = async ({ f, p }, tag) => {
    await say(p.text, `${tag}:${f.type}`);
    await waitIdle(`${tag} ${f.id}`);
    plantedIn[f.id] = sessions(); plantedAt[f.id] = new Date().toISOString();
  };
  let w = 0, compacts = 0;
  for (const x of early) await plant(x, "plant");
  // One work turn between the early plants and the late corrections, then the late ones.
  const t0 = workTurn(); w++; await say(t0, "work:0"); await waitIdle("work 0");
  for (const x of late) await plant(x, "plant-late");
  // The same W work turns in every arm; probes start only after W, never on "clears reached".
  // cm clears on its own (nudge calibrated by pilot so it reaches K inside W); compact every 3.
  const sessionsAfterPlants = sessions();
  while (w < W) {
    await say(workTurn(), `work:${w}`); w++;
    await waitIdle(`work ${w}`);
    if (ARM === "compact" && w % COMPACT_EVERY === 0) { await say("/compact", "compact"); compacts++; await waitIdle("compact", { noStop: true }); }
  }
  const sessionsAtProbes = sessions();
  // Clears inside W after the last plant (cm). Below K, the trial is under-pressured: kept, flagged.
  const clearsInWork = sessionsAtProbes - sessionsAfterPlants;
  if (ARM === "cm" && clearsInWork < CLEARS) log(`UNDER-PRESSURE: ${clearsInWork} clears after the plants, wanted ${CLEARS}`);
  const hs = handovers();
  // Written is scored only on handovers filed after the fact's last plant (a late correction
  // cannot be in an earlier handover, smoke 2).
  const after = (f) => hs.filter((h) => String(h.createdAt) > (plantedAt[f.id] ?? ""));
  log(`work turns ${w}, sessions ${sessions()}, handovers ${hs.length}, compacts ${compacts}`);

  // Probes, in a fixed order, each from a committed baseline.
  const results = [];
  for (const f of facts) {
    const baseline = snapshot();
    const sessBefore = sessions();
    await say(f.probe, `probe:${f.type}`);
    await waitIdle(`probe ${f.id}`);
    const acted = runChecker(f, baseline);
    results.push({ type: f.type, id: f.id, acted: acted.result, detail: acted.detail, clearedDuringProbe: sessions() > sessBefore, clearsCrossed: sessionsAtProbes - (plantedIn[f.id] ?? sessionsAtProbes), written: ARM === "cm" ? writtenScore(f, after(f)) : null, stale: ARM === "cm" ? staleScore(f, after(f)) : null });
    log(`PROBE ${f.type} ${acted.result} ${acted.detail ?? ""}`);
  }

  writeFileSync(join(OUT, "result.json"), JSON.stringify({ arm: ARM, seed: SEED, clears: CLEARS, model: MODEL, nudge: NUDGE, workTurns: w, W, clearsInWork, sessions: sessions(), handovers: hs.length, compacts, memoryFiles: memoryFiles(), results }, null, 1));
  mkdirSync(join(OUT, "transcripts"), { recursive: true });
  for (const t of transcripts()) cpSync(t.p, join(OUT, "transcripts", t.p.split("/").at(-1)), { recursive: true });
  if (existsSync(join(homedir(), ".cornerman"))) cpSync(join(homedir(), ".cornerman"), join(OUT, "cm"), { recursive: true });
  tmux("kill-server");
}

main().catch((e) => { log(`DRIVER ERROR ${e.stack}`); process.exit(1); });
