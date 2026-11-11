#!/usr/bin/env node
// Gate server for one run. Reveals checkpoints one at a time.
//   node gate-server.mjs --repo <agent repo> --run <run dir, outside the repo> [--port 0]
// Writes <repo>/.gate.json with its URL (the repo's gate.mjs reads it).
// POST /next  - if every visible test so far passes: snapshot, log, write the next visible
//               test into the repo, return its spec. Otherwise return the failures.
//               The first reveal alone also carries HOUSE-RULES.md (chat-only, shown once).
// GET /status - { current, total, done }
// State lives in <run>/gate-state.json so a restart resumes where it was.
// Recall probes (probes.json, never copied into the repo): after the checkpoint a probe follows,
// /next refuses until <repo>/PROBES.md has a non-empty line for each of its questions. The gate
// shows only id + ask, and copies PROBES.md to <run>/probes-<id>.md when answered, so later
// edits cannot change the score. Logs probe-asked / probe-answered for the token join.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, cpSync, appendFileSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CPS = resolve(HERE, "..", "checkpoints");

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i === -1 ? dflt : process.argv[i + 1];
}
const REPO = resolve(arg("--repo"));
const RUN = resolve(arg("--run"));
const PORT = Number(arg("--port", "0"));
if (!existsSync(REPO)) throw new Error(`repo ${REPO} missing`);
if (!relative(REPO, RUN).startsWith("..")) throw new Error("--run must be outside --repo");
mkdirSync(join(RUN, "snapshots"), { recursive: true });

const ALL = readdirSync(CPS).filter((d) => /^cp\d\d$/.test(d)).sort();
const STATE = join(RUN, "gate-state.json");
const PROBES = JSON.parse(readFileSync(join(HERE, "probes.json"), "utf8")).probes;
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { current: 0, visibleHashes: {} };
state.probes ??= {}; // id -> "asked" | "answered"
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2));
const log = (event) => appendFileSync(join(RUN, "gate-log.jsonl"), JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n");

const sha = (text) => createHash("sha256").update(text).digest("hex");

function runVisible() {
  const dir = join(REPO, "test", "visible");
  if (!existsSync(dir) || !readdirSync(dir).length) return { ok: true, failed: [] };
  const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", "test/visible/**/*.test.mjs"], { cwd: REPO, encoding: "utf8", timeout: 180000 });
  const out = (r.stdout || "") + (r.stderr || "");
  const failed = [...out.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1]);
  const pass = Number((/^# pass (\d+)/m.exec(out) || [])[1] || 0);
  return { ok: r.status === 0 && failed.length === 0 && pass > 0, failed, tail: out.slice(-1500) };
}

function headSha() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

function snapshot(name) {
  const to = join(RUN, "snapshots", name);
  cpSync(REPO, to, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
  return to;
}

// Question ids with a non-empty answer line in PROBES.md (same line shape check-probes.mjs reads).
function answered() {
  const f = join(REPO, "PROBES.md");
  const ids = new Set();
  if (!existsSync(f)) return ids;
  for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*[-*]?\s*\**(P\d+\.\d+)\**\s*[:=]\s*(.*)$/i);
    if (m && m[2].trim()) ids.add(m[1].toUpperCase());
  }
  return ids;
}

// null when no probe is waiting after checkpoint `done`, else the refusal to send.
function probeGate(done) {
  const p = PROBES.find((x) => x.after === done && state.probes[x.id] !== "answered");
  if (!p) return null;
  const have = answered();
  const missing = p.questions.filter((q) => !have.has(q.id));
  if (!missing.length) {
    cpSync(join(REPO, "PROBES.md"), join(RUN, `probes-${p.id}.md`));
    state.probes[p.id] = "answered";
    save();
    log({ event: "probe-answered", probe: p.id, cp: state.current, head: headSha() });
    return null;
  }
  if (state.probes[p.id] !== "asked") {
    state.probes[p.id] = "asked";
    save();
    log({ event: "probe-asked", probe: p.id, cp: state.current, head: headSha() });
  }
  const lines = p.questions.map((q) => `${q.id}: ${q.ask}`).join("\n");
  return {
    status: 409,
    body: `Not yet: recall check ${p.id}. Before the next checkpoint, append one line per question to PROBES.md at the repo root, in the form \`${p.questions[0].id}: <answer>\`. Answer from what you remember and any notes you kept; do not run code or tests to work the answers out. Then commit and run \`node gate.mjs next\`.\n\n${lines}\n\nStill unanswered: ${missing.map((q) => q.id).join(", ")}\n`,
  };
}

function next() {
  if (state.finished) return { status: 200, body: "ALL DONE. Every checkpoint is finished.\n" };
  if (state.current > 0) {
    const v = runVisible();
    if (!v.ok) {
      log({ event: "refused", cp: state.current, failed: v.failed });
      return { status: 409, body: `Not yet: visible tests fail.\n${v.failed.map((f) => `  - ${f}`).join("\n")}\n${v.failed.length ? "" : v.tail}\n` };
    }
    const done = ALL[state.current - 1];
    // The scored snapshot is the first passing tree; a probe stop must not move it.
    if (!existsSync(join(RUN, "snapshots", `${done}-done`))) {
      snapshot(`${done}-done`);
      log({ event: "done", cp: state.current, head: headSha() });
    }
    const wait = probeGate(done);
    if (wait) return wait;
  }
  if (state.current === ALL.length) {
    state.finished = true;
    save();
    log({ event: "finished" });
    return { status: 200, body: "ALL DONE. Every checkpoint is finished.\n" };
  }
  const cp = ALL[state.current];
  state.current++;
  const vis = readFileSync(join(CPS, cp, "visible.test.mjs"), "utf8");
  mkdirSync(join(REPO, "test", "visible"), { recursive: true });
  writeFileSync(join(REPO, "test", "visible", `${cp}.test.mjs`), vis);
  state.visibleHashes[cp] = sha(vis);
  save();
  log({ event: "revealed", cp: state.current, head: headSha() });
  const spec = readFileSync(join(CPS, cp, "spec.md"), "utf8");
  const tail = state.current === ALL.length
    ? "\nThis is the last checkpoint. When its visible tests pass, run `node gate.mjs next` once more to finish.\n"
    : "\nWhen this checkpoint is done and committed, run `node gate.mjs next`.\n";
  // The house rules are printed once, with the first checkpoint, for every arm. They used to sit
  // in START-PROMPT.md, which the cornerman relay sends again at the start of every segment
  // (plugin lib/run.mjs), so CM arms were reminded of them and the other arms were not.
  const rules = state.current === 1 ? `${readFileSync(join(HERE, "HOUSE-RULES.md"), "utf8")}\n` : "";
  return { status: 200, body: `${rules}${spec}\nVisible tests written to test/visible/${cp}.test.mjs.\n${tail}` };
}

const server = createServer((req, res) => {
  let out;
  try {
    if (req.method === "POST" && req.url === "/next") out = next();
    else if (req.method === "GET" && req.url === "/status") {
      out = { status: 200, body: JSON.stringify({ current: state.current, total: ALL.length, done: !!state.finished }) + "\n" };
    } else out = { status: 404, body: "not found\n" };
  } catch (e) {
    log({ event: "error", message: String(e && e.stack || e) });
    out = { status: 500, body: "gate error\n" };
  }
  res.writeHead(out.status, { "content-type": "text/plain; charset=utf-8" });
  res.end(out.body);
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${server.address().port}`;
  writeFileSync(join(REPO, ".gate.json"), JSON.stringify({ url }) + "\n");
  log({ event: "listening", url, current: state.current });
  console.log(url);
});
