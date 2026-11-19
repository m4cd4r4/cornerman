#!/usr/bin/env node
// Hybrid smoke (STRESS-TEST-DESIGN.md, build step 1): the four hybrid hooks in the real terminal app,
// one typed /compact and one auto compaction at the window. Not a trial: n = 1, no checker, no score.
//   docker run ... -e CM_INSTALL=0 -e CM_REF=<sha> cornerman-eval:dev node /rig/hybrid/smoke.mjs [--model sonnet] [--window 100000] [--max-work 8]
// cornerman is cloned for its lib only; the plugin is not installed, so none of its own hooks run.
// Answers: do the PreCompact instructions produce the tagged section; does PostCompact run before
// SessionStart; does the rulings log reach the model after each compaction; at what size.
// Writes /out/result.json, /out/hybrid (the store), /out/transcripts, /out/screens.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf(n); return i < 0 ? d : process.argv[i + 1]; };
const MODEL = arg("--model", "sonnet"), WINDOW = arg("--window", "100000"), MAX_WORK = Number(arg("--max-work", "8"));
const OUT = "/out", WORK = "/work", STORE = "/out/hybrid", IDLE_MS = 15000, TURN_MAX_MS = 20 * 60_000;
const PROJ = join(homedir(), ".claude", "projects");
const DOCS = "/usr/local/lib/node_modules/npm/docs/content";
const STOPS = "/tmp/stops";
const CM_SRC = join(homedir(), "cornerman-src");

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
const traceRows = (name) => lines(join(STORE, "trace", `${name}.jsonl`)).map((l) => JSON.parse(l));
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

const QUESTION = "Without reading any files or running any tools, one line each, and say unknown for anything you do not know: (1) what is the staging port, (2) how many spaces per indent for new code, (3) how is money stored, (4) which storage option did I pick, (5) what is the audit bucket id.";
// (5) is unknown after the first compaction. Before the second, the driver files a fact in the
// hybrid's state that no summary will hold, so the answer can only come from deliver.mjs.
const BUCKET = "QZ-88213";
const grade = (a) => ({ port: /4417/.test(a), indent: /\b3\b|three/i.test(a) && !/\b2 spaces\b/i.test(a), money: /integer cents/i.test(a), choice: /sqlite/i.test(a), bucket: a.includes(BUCKET) });

// What one compaction did, read from the hooks' own traces and the transcript.
function compaction(i, b0) {
  const pre = traceRows("precompact")[i], post = traceRows("postcompact")[i], start = traceRows("sessionstart")[i];
  const summary = existsSync(STORE) && post ? readFileSync(join(STORE, "summaries", readdirSync(join(STORE, "summaries")).sort().at(i)), "utf8") : "";
  return {
    boundary: boundaries().slice(b0).map((b) => ({ trigger: b.compactMetadata?.trigger, preTokens: b.compactMetadata?.preTokens, postTokens: b.compactMetadata?.postTokens })),
    preTrigger: pre?.trigger ?? null,
    post: post ?? null, start: start ?? null,
    postBeforeStart: post && start ? post.at <= start.at : null,
    summaryHasSection: /Carried forward/.test(summary),
    summaryHasPort: /4417/.test(summary), summaryHasMoneyRule: /integer cents/i.test(summary),
  };
}

async function main() {
  mkdirSync(join(OUT, "screens"), { recursive: true });
  cpSync("/test1/fixture", WORK, { recursive: true });
  mkdirSync(join(WORK, "scripts"), { recursive: true });
  writeFileSync(join(WORK, "scripts", "print-port.mjs"), 'console.log("staging port: " + (4000 + 417));\n');
  sh("git", ["init", "-q", WORK]);
  sh("git", ["config", "--global", "user.email", "dev@example.com"]);
  sh("git", ["config", "--global", "user.name", "Dev"]);
  sh("git", ["-C", WORK, "add", "-A"]); sh("git", ["-C", WORK, "commit", "-qm", "ledger baseline"]);

  if (!existsSync(CM_SRC)) {
    sh("git", ["clone", "-q", process.env.CM_SOURCE || "https://github.com/m4cd4r4/cornerman", CM_SRC]);
    if (process.env.CM_REF) sh("git", ["-C", CM_SRC, "checkout", "-q", process.env.CM_REF]);
  }
  const cmSha = sh("git", ["-C", CM_SRC, "rev-parse", "HEAD"]).trim();

  mkdirSync(join(homedir(), ".claude"), { recursive: true });
  const S = join(homedir(), ".claude", "settings.json");
  const settings = existsSync(S) ? JSON.parse(readFileSync(S, "utf8")) : {};
  const hook = (file) => [{ hooks: [{ type: "command", command: `node ${join(HERE, file)}` }] }];
  settings.permissions = { allow: ["Bash", "Read", "Edit", "Write", "Glob", "Grep", "Skill"] };
  settings.hooks = { Stop: [{ hooks: [{ type: "command", command: `date +%s%N >> ${STOPS}` }] }], UserPromptSubmit: hook("prompt.mjs"), PreCompact: hook("pre.mjs"), PostCompact: hook("post.mjs"), SessionStart: hook("start.mjs"), PostToolUse: hook("deliver.mjs") };
  settings.autoMemoryEnabled = false;
  writeFileSync(S, JSON.stringify(settings, null, 1));

  writeFileSync("/tmp/run-claude.sh", `export CLAUDE_CODE_DISABLE_AUTO_MEMORY=1\nexport HYBRID_STORE=${STORE}\nexport CM_LIB=${join(CM_SRC, "plugin", "scripts", "lib")}\ncd ${WORK}\nclaude --model ${MODEL} --autocompact ${WINDOW}\necho CLAUDE-EXITED $?\nsleep 3600\n`);
  tmux("new-session", "-d", "-s", "t", "-x", "200", "-y", "50", "bash /tmp/run-claude.sh");
  await sleep(10_000);
  const R = { model: MODEL, window: WINDOW, cornerman: cmSha, startScreen: screen("start").slice(0, 2000), compactions: [] };

  await say("We're working on ledger, a small Node money-ledger library in this folder. Start by reading README.md and listing the source files.", "brief");
  await say("New code uses 2 spaces per indent.", "rule-indent");
  await say("Never use floats for money, integer cents only.", "rule-money");
  await say("Run scripts/print-port.mjs once, tell me what it prints, then delete the script and commit the deletion. We will need that port later.", "fact-port");
  await say("For where ledger keeps its data, describe three options in two lines each, numbered 1 to 3: JSON files, SQLite, and an append-only log file. Do not build anything yet.", "options");
  await say("The second one.", "choice");
  await say("Actually make that 3 spaces.", "rule-indent-late");

  // 1. Typed /compact.
  let b0 = boundaries().length;
  await say("/compact", "compact-manual", { noStop: true });
  R.compactions.push({ kind: "manual", ...compaction(0, b0) });
  log(`manual: ${JSON.stringify(R.compactions[0])}`);
  await say(QUESTION, "question-after-manual");
  R.compactions[0].answer = lastAssistant(); R.compactions[0].graded = grade(R.compactions[0].answer);
  log(`manual answer: ${R.compactions[0].answer.replace(/\n/g, " | ").slice(0, 400)}`);

  // 2. Auto compaction at the window: read until it fires by itself.
  const docs = ["commands", "using-npm", "configuring-npm"].flatMap((d) => readdirSync(join(DOCS, d)).filter((f) => f.endsWith(".md")).sort().map((f) => join(DOCS, d, f)));
  b0 = boundaries().length;
  R.auto = { fired: false, turns: [] };
  const stateFile = join(STORE, "state", readdirSync(join(STORE, "state"))[0]);
  const state = JSON.parse(readFileSync(stateFile, "utf8"));
  state.items.push({ tag: "fact", text: `The audit bucket id is ${BUCKET}, printed by scripts/print-bucket.mjs before it was deleted.`, first: 1, last: 1, inLatest: true });
  writeFileSync(stateFile, JSON.stringify(state));
  for (let w = 0; w < MAX_WORK && !R.auto.fired; w++) {
    const batch = docs.slice(w * 6, w * 6 + 6);
    await say(`Next batch of reading for the ledger docs: read each of these files one at a time with the Read tool and add one line per file to docs/npm-notes.md saying which npm feature could matter for ledger's release process and why: ${batch.join(", ")}. Commit when the batch is done.`, `work:${w}`);
    R.auto.turns.push({ w, contextAfter: lastUsage(), boundaries: boundaries().length - b0 });
    log(`work ${w}: context ${lastUsage()}, boundaries +${boundaries().length - b0}`);
    R.auto.fired = boundaries().length > b0;
  }
  if (R.auto.fired) {
    R.compactions.push({ kind: "auto", ...compaction(1, b0) });
    log(`auto: ${JSON.stringify(R.compactions[1])}`);
    await say(QUESTION, "question-after-auto");
    R.compactions[1].answer = lastAssistant(); R.compactions[1].graded = grade(R.compactions[1].answer);
    log(`auto answer: ${R.compactions[1].answer.replace(/\n/g, " | ").slice(0, 400)}`);
  }
  R.errors = traceRows("error");
  R.deliveries = traceRows("deliver");
  // Did each load reach the model? The hook's opening words must be in the transcript after each compaction.
  R.contextInTranscript = entries().filter((e) => JSON.stringify(e).includes("cornerman hybrid: this context was just compacted")).length;

  writeFileSync(join(OUT, "result.json"), JSON.stringify(R, null, 1));
  mkdirSync(join(OUT, "transcripts"), { recursive: true });
  for (const t of transcripts()) cpSync(t.p, join(OUT, "transcripts", t.p.split("/").at(-1)));
  tmux("kill-server");
}

main().catch((e) => { log(`DRIVER ERROR ${e.stack}`); writeFileSync(join(OUT, "error.txt"), String(e.stack)); process.exit(1); });
