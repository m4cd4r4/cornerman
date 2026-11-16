#!/usr/bin/env node
// Test 1 trial driver: plays the user in the real Claude Code terminal app (tmux), inside the
// cornerman-eval container. Plants the seed's facts in chat, sends read-heavy work turns until the
// arm's clear count is reached, then sends each probe and runs its checker. Writes /out/result.json.
//   node driver.mjs --arm cm|full|compact --seed N --clears K [--model sonnet] [--nudge-at 35000]
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
const COMPACT_EVERY = Number(arg("--compact-every", "3")), MAX_WORK = Number(arg("--max-work", "14"));
const OUT = arg("--out", "/out"), WORK = "/work", IDLE_MS = Number(arg("--idle-ms", "15000"));
const TURN_MAX_MS = 20 * 60_000;
const PROJ = join(homedir(), ".claude", "projects");
const DOCS = "/usr/local/lib/node_modules/npm/docs/content/commands";

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
const sessions = () => transcripts().length;

// Turn ends come from a Stop hook the driver installs (one line per Stop in STOPS): the screen
// alone misread a long thinking pause as idle (smoke 2026-11-16, probes typed into a busy turn).
const STOPS = "/tmp/stops";
const stopCount = () => (existsSync(STOPS) ? readFileSync(STOPS, "utf8").split("\n").filter(Boolean).length : 0);
let stopsAtSay = 0;

async function waitIdle(label) {
  const start = Date.now();
  let quietSince = null, lastSig = "";
  while (Date.now() - start < TURN_MAX_MS) {
    await sleep(2000);
    const screen = tmux("capture-pane", "-p", "-t", "t");
    const n = newest();
    const sig = `${n?.p}:${n?.s}:${stopCount()}`;
    const busy = stopCount() <= stopsAtSay || /esc to interrupt|… \(\d+s/i.test(screen) || sig !== lastSig;
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

// Work turns: real reading (npm's own command docs), so context grows on content the agent needs.
const docFiles = readdirSync(DOCS).filter((f) => f.endsWith(".md")).sort();
let docAt = 0;
function workTurn(i) {
  const batch = docFiles.slice(docAt, docAt + 6);
  docAt += 6;
  if (!batch.length) return null;
  return `Next batch of reading for the ledger docs: read each of these files in ${DOCS}/ one at a time with the Read tool and add one line per file to docs/npm-notes.md saying which npm command could matter for ledger's release process and why: ${batch.join(", ")}. Commit when the batch is done.`;
}

function runChecker(fact, baseline) {
  const factFile = `/tmp/fact-${fact.id}.json`;
  writeFileSync(factFile, JSON.stringify(fact));
  const r = spawnSync("node", [join(HERE, fact.check), WORK, factFile], {
    encoding: "utf8", env: { ...process.env, BASELINE: baseline, TRANSCRIPT: newest()?.p ?? "" }, timeout: 120_000,
  });
  try { return JSON.parse(r.stdout.trim().split("\n").at(-1)); } catch { return { result: "checker-error", detail: (r.stderr || r.stdout || "").slice(0, 400) }; }
}

function handovers() {
  const dir = join(homedir(), ".cornerman", "handovers");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function writtenScore(fact, hs) {
  // Per handover in the chain: every `written` regex matches and no `absent` one does.
  return hs.map((h) => {
    const text = `${h.title ?? ""}\n${h.body ?? ""}`;
    const has = (fact.written ?? []).every((re) => new RegExp(re, "i").test(text));
    const clean = !(fact.absent ?? []).some((re) => new RegExp(re, "i").test(text));
    return has && clean;
  });
}

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
  writeFileSync(S, JSON.stringify(settings, null, 1));

  writeFileSync("/tmp/run-claude.sh", `export CORNERMAN_NUDGE_AT=${NUDGE}\ncd ${WORK}\nclaude --model ${MODEL}\necho CLAUDE-EXITED $?\nsleep 3600\n`);
  tmux("new-session", "-d", "-s", "t", "-x", "200", "-y", "50", "bash /tmp/run-claude.sh");
  await sleep(10_000);

  const early = facts.flatMap((f) => f.plant.filter((p) => p.phase === "early").map((p) => ({ f, p })));
  const late = facts.flatMap((f) => f.plant.filter((p) => p.phase === "late").map((p) => ({ f, p })));

  // Opening brief, then the early plants one per turn, each with a work turn between.
  await say("We're working on ledger, a small Node money-ledger library in this folder. I'll give you tasks one at a time. Start by reading README.md and listing the source files.", "brief");
  await waitIdle("brief");
  // Every plant records the session it landed in, so each fact's probe can say how many clears
  // it actually crossed (a clear can land in the middle of the plants).
  const plantedIn = {};
  const plant = async ({ f, p }, tag) => {
    await say(p.text, `${tag}:${f.type}`);
    await waitIdle(`${tag} ${f.id}`);
    plantedIn[f.id] = sessions();
  };
  let w = 0, compacts = 0;
  for (const x of early) await plant(x, "plant");
  // One work turn between the early plants and the late corrections, then the late ones.
  const t0 = workTurn(w++); await say(t0, "work:0"); await waitIdle("work 0");
  for (const x of late) await plant(x, "plant-late");
  // Work until every fact has crossed CLEARS clears (cm), or the same work for the control arms.
  const lastPlant = () => Math.max(...Object.values(plantedIn));
  while (w < MAX_WORK) {
    if (ARM === "cm" && sessions() >= lastPlant() + CLEARS) break;
    if (ARM === "compact" && compacts >= CLEARS) break;
    if (ARM === "full" && w >= Number(arg("--full-work", String(1 + 3 * CLEARS)))) break;
    const t = workTurn(w); if (!t) break;
    await say(t, `work:${w}`); w++;
    await waitIdle(`work ${w}`);
    if (ARM === "compact" && w % COMPACT_EVERY === 0) { await say("/compact", "compact"); compacts++; await waitIdle("compact"); }
  }
  const sessionsAtProbes = sessions();
  const hs = handovers();
  log(`work turns ${w}, sessions ${sessions()}, handovers ${hs.length}, compacts ${compacts}`);

  // Probes, in a fixed order, each from a committed baseline.
  const results = [];
  for (const f of facts) {
    git("add", "-A"); spawnSync("git", ["-C", WORK, "commit", "-qm", `before probe ${f.id}`]);
    const baseline = git("rev-parse", "HEAD");
    const sessBefore = sessions();
    await say(f.probe, `probe:${f.type}`);
    await waitIdle(`probe ${f.id}`);
    const acted = runChecker(f, baseline);
    results.push({ type: f.type, id: f.id, acted: acted.result, detail: acted.detail, clearedDuringProbe: sessions() > sessBefore, clearsCrossed: sessionsAtProbes - (plantedIn[f.id] ?? sessionsAtProbes), written: ARM === "cm" ? writtenScore(f, hs) : null });
    log(`PROBE ${f.type} ${acted.result} ${acted.detail ?? ""}`);
  }

  writeFileSync(join(OUT, "result.json"), JSON.stringify({ arm: ARM, seed: SEED, clears: CLEARS, model: MODEL, nudge: NUDGE, workTurns: w, sessions: sessions(), handovers: hs.length, compacts, results }, null, 1));
  mkdirSync(join(OUT, "transcripts"), { recursive: true });
  for (const t of transcripts()) cpSync(t.p, join(OUT, "transcripts", t.p.split("/").at(-1)), { recursive: true });
  if (existsSync(join(homedir(), ".cornerman"))) cpSync(join(homedir(), ".cornerman"), join(OUT, "cm"), { recursive: true });
  tmux("kill-server");
}

main().catch((e) => { log(`DRIVER ERROR ${e.stack}`); process.exit(1); });
