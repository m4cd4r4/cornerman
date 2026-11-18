#!/usr/bin/env node
// Compaction spike (STRESS-TEST-DESIGN.md, build step 0): what can a plugin do around compaction
// at the rig's CLI version? Real Claude Code terminal app in tmux, no cornerman, three logging hooks.
//   node /rig/spike/spike-compact.mjs [--model sonnet] [--window 100000] [--max-work 8]
// Checks, in order:
//   1. PreCompact exit 2 blocks a typed /compact.
//   2. Typed /compact: PreCompact (trigger manual) stdout reaches the summary; PostCompact input
//      carries the summary; SessionStart fires with source compact and its context reaches the model.
//   3. `--autocompact <window>`: compaction fires by itself, at what token count, with the same hooks.
// Writes /out/result.json, /out/hooks/*.jsonl, /out/transcripts, /out/screens.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf(n); return i < 0 ? d : process.argv[i + 1]; };
const MODEL = arg("--model", "sonnet"), WINDOW = arg("--window", "100000"), MAX_WORK = Number(arg("--max-work", "8"));
const OUT = "/out", WORK = "/work", IDLE_MS = 15000, TURN_MAX_MS = 20 * 60_000;
const PROJ = join(homedir(), ".claude", "projects");
const DOCS = "/usr/local/lib/node_modules/npm/docs/content";
const STOPS = "/tmp/stops";

const log = (m) => { const l = `${new Date().toISOString()} ${m}`; console.log(l); writeFileSync(join(OUT, "driver.log"), l + "\n", { flag: "a" }); };
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", ...opts });
const tmux = (...a) => spawnSync("tmux", a, { encoding: "utf8" }).stdout ?? "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lines = (p) => (existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean) : []);
const stopCount = () => lines(STOPS).length;
let stopsAtSay = 0, shot = 0;

function transcripts() {
  if (!existsSync(PROJ)) return [];
  return readdirSync(PROJ).flatMap((d) => readdirSync(join(PROJ, d)).filter((f) => f.endsWith(".jsonl")).map((f) => join(PROJ, d, f)))
    .map((p) => ({ p, t: statSync(p).mtimeMs, s: statSync(p).size })).sort((a, b) => a.t - b.t);
}
const entries = () => transcripts().flatMap((t) => lines(t.p).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean));
const boundaries = () => entries().filter((e) => e.subtype === "compact_boundary");
const hookLog = (name) => lines(join(OUT, "hooks", `${name}.jsonl`)).map((l) => { const r = JSON.parse(l); try { r.parsed = JSON.parse(r.input); } catch {} return r; });
const lastAssistant = () => {
  const a = entries().filter((e) => e.type === "assistant").at(-1);
  return (a?.message?.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
};
const lastUsage = () => {
  const u = entries().filter((e) => e.type === "assistant" && e.message?.usage).at(-1)?.message.usage;
  return u ? (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) : null;
};
const screen = (label) => { const s = tmux("capture-pane", "-p", "-t", "t"); writeFileSync(join(OUT, "screens", `${String(++shot).padStart(2, "0")}-${label}.txt`), s); return s; };

async function waitIdle(label, { noStop = false } = {}) {
  const start = Date.now();
  let quietSince = null, lastSig = "";
  while (Date.now() - start < TURN_MAX_MS) {
    await sleep(2000);
    const s = tmux("capture-pane", "-p", "-t", "t");
    if (/Enter to select · [^\n]*to navigate/.test(s)) { log(`CARD during ${label}: cancelled with Esc`); tmux("send-keys", "-t", "t", "Escape"); noStop = true; quietSince = null; continue; }
    const n = transcripts().at(-1);
    const sig = `${n?.p}:${n?.s}:${stopCount()}`;
    const busy = (!noStop && stopCount() <= stopsAtSay) || /esc to interrupt|… \(\d+s/i.test(s) || sig !== lastSig;
    lastSig = sig;
    if (busy) quietSince = null;
    else if (!quietSince) quietSince = Date.now();
    else if (Date.now() - quietSince >= IDLE_MS) { screen(label); return true; }
  }
  log(`TIMEOUT waiting for idle after ${label}`);
  screen(`${label}-timeout`);
  return false;
}
async function say(text, label, opts) {
  stopsAtSay = stopCount();
  writeFileSync("/tmp/say.txt", text);
  tmux("load-buffer", "/tmp/say.txt"); tmux("paste-buffer", "-t", "t");
  await sleep(600);
  tmux("send-keys", "-t", "t", "Enter");
  log(`SAY [${label}] ${text.slice(0, 100).replace(/\n/g, " ")}`);
  return waitIdle(label, opts);
}

const QUESTION = "Without reading any files or running any tools: what is the staging port, and what is the deploy codeword? One line each. Say unknown for anything you do not know.";

async function main() {
  mkdirSync(join(OUT, "hooks"), { recursive: true });
  mkdirSync(join(OUT, "screens"), { recursive: true });
  cpSync("/test1/fixture", WORK, { recursive: true });
  sh("git", ["init", "-q", WORK]);
  sh("git", ["config", "--global", "user.email", "dev@example.com"]);
  sh("git", ["config", "--global", "user.name", "Dev"]);
  sh("git", ["-C", WORK, "add", "-A"]); sh("git", ["-C", WORK, "commit", "-qm", "ledger baseline"]);

  mkdirSync(join(homedir(), ".claude"), { recursive: true });
  const S = join(homedir(), ".claude", "settings.json");
  const settings = existsSync(S) ? JSON.parse(readFileSync(S, "utf8")) : {};
  const hook = (file) => [{ hooks: [{ type: "command", command: `node ${join(HERE, file)}` }] }];
  settings.permissions = { allow: ["Bash", "Read", "Edit", "Write", "Glob", "Grep", "Skill"] };
  settings.hooks = { Stop: [{ hooks: [{ type: "command", command: `date +%s%N >> ${STOPS}` }] }], PreCompact: hook("pre.mjs"), PostCompact: hook("post.mjs"), SessionStart: hook("start.mjs") };
  settings.autoMemoryEnabled = false;
  writeFileSync(S, JSON.stringify(settings, null, 1));

  writeFileSync("/tmp/run-claude.sh", `export CLAUDE_CODE_DISABLE_AUTO_MEMORY=1\ncd ${WORK}\nclaude --model ${MODEL} --autocompact ${WINDOW}\necho CLAUDE-EXITED $?\nsleep 3600\n`);
  tmux("new-session", "-d", "-s", "t", "-x", "200", "-y", "50", "bash /tmp/run-claude.sh");
  await sleep(10_000);
  const R = { model: MODEL, window: WINDOW, startScreen: screen("start").slice(0, 2000) };

  await say("We're working on ledger, a small Node money-ledger library in this folder. Note for later: the deploy codeword is HERON. Start by reading README.md and listing the source files.", "brief");

  // 1. PreCompact exit 2 blocks.
  writeFileSync("/tmp/block-next", "1");
  let b0 = boundaries().length;
  await say("/compact", "compact-blocked", { noStop: true });
  R.block = { preCompactCalls: hookLog("precompact").length, boundariesAdded: boundaries().length - b0, flagConsumed: !existsSync("/tmp/block-next") };
  log(`block: ${JSON.stringify(R.block)}`);

  // 2. Typed /compact with hooks.
  b0 = boundaries().length;
  const post0 = hookLog("postcompact").length, start0 = hookLog("sessionstart").length;
  await say("/compact", "compact-manual", { noStop: true });
  const pre = hookLog("precompact").at(-1), post = hookLog("postcompact").slice(post0), starts = hookLog("sessionstart").slice(start0);
  const summaries = entries().filter((e) => e.isCompactSummary).map((e) => (typeof e.message?.content === "string" ? e.message.content : JSON.stringify(e.message?.content)));
  R.manual = {
    boundariesAdded: boundaries().length - b0,
    boundary: boundaries().at(-1)?.compactMetadata ?? null,
    preInputKeys: Object.keys(pre?.parsed ?? {}), preTrigger: pre?.parsed?.trigger ?? null,
    postCalls: post.length, postInputKeys: Object.keys(post.at(-1)?.parsed ?? {}),
    postHasSummaryText: post.some((p) => /HERON/.test(p.input)), postHasMarker: post.some((p) => /MARKER-ZEBRA-7731/.test(p.input)),
    transcriptSummaryHasMarker: summaries.some((s) => /MARKER-ZEBRA-7731/.test(s)),
    transcriptSummaryHasCodeword: summaries.some((s) => /HERON/.test(s)),
    sessionStartSources: starts.map((s) => s.parsed?.source ?? null),
  };
  log(`manual: ${JSON.stringify(R.manual)}`);
  await say(QUESTION, "question-after-manual");
  R.manual.answer = lastAssistant();
  R.manual.answerHasPort = /4417/.test(R.manual.answer); R.manual.answerHasCodeword = /HERON/i.test(R.manual.answer);
  log(`manual answer: ${R.manual.answer.replace(/\n/g, " | ").slice(0, 300)}`);

  // 3. Auto-compact at the window: read until it fires by itself.
  const docs = ["commands", "using-npm", "configuring-npm"].flatMap((d) => readdirSync(join(DOCS, d)).filter((f) => f.endsWith(".md")).sort().map((f) => join(DOCS, d, f)));
  b0 = boundaries().length;
  const pre0 = hookLog("precompact").length, post1 = hookLog("postcompact").length, start1 = hookLog("sessionstart").length;
  R.auto = { fired: false, turns: [] };
  for (let w = 0; w < MAX_WORK && !R.auto.fired; w++) {
    const batch = docs.slice(w * 6, w * 6 + 6);
    await say(`Next batch of reading for the ledger docs: read each of these files one at a time with the Read tool and add one line per file to docs/npm-notes.md saying which npm feature could matter for ledger's release process and why: ${batch.join(", ")}. Commit when the batch is done.`, `work:${w}`);
    R.auto.turns.push({ w, contextAfter: lastUsage(), boundaries: boundaries().length - b0 });
    log(`work ${w}: context ${lastUsage()}, boundaries +${boundaries().length - b0}`);
    R.auto.fired = boundaries().length > b0;
  }
  const preA = hookLog("precompact").slice(pre0), postA = hookLog("postcompact").slice(post1), startA = hookLog("sessionstart").slice(start1);
  Object.assign(R.auto, {
    boundary: boundaries().slice(b0).map((b) => b.compactMetadata ?? null),
    preTriggers: preA.map((p) => p.parsed?.trigger ?? null),
    postCalls: postA.length, postHasMarker: postA.some((p) => /MARKER-ZEBRA-7731/.test(p.input)),
    sessionStartSources: startA.map((s) => s.parsed?.source ?? null),
    transcriptFiles: transcripts().length,
  });
  log(`auto: ${JSON.stringify(R.auto)}`);
  if (R.auto.fired) {
    await say(QUESTION, "question-after-auto");
    R.auto.answer = lastAssistant();
    R.auto.answerHasPort = /4417/.test(R.auto.answer); R.auto.answerHasCodeword = /HERON/i.test(R.auto.answer);
    log(`auto answer: ${R.auto.answer.replace(/\n/g, " | ").slice(0, 300)}`);
  }

  writeFileSync(join(OUT, "result.json"), JSON.stringify(R, null, 1));
  mkdirSync(join(OUT, "transcripts"), { recursive: true });
  for (const t of transcripts()) cpSync(t.p, join(OUT, "transcripts", t.p.split("/").at(-1)));
  tmux("kill-server");
}

main().catch((e) => { log(`DRIVER ERROR ${e.stack}`); writeFileSync(join(OUT, "error.txt"), String(e.stack)); process.exit(1); });
