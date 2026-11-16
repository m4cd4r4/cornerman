#!/usr/bin/env node
// A stand-in for `claude -p` that the runner tests drive. It reads its prompt from
// stdin, logs what it was given, and does what the plan says for this call:
//   FAKE_PLAN  JSON file, an array of { commit, save, cost, exit, pause } per call
//   pause: <tokens>  runs the real PostToolUse hook on a transcript of that context size, as a
//                    tool call past the nudge threshold would; its output goes to stdout
//   FAKE_LOG   JSONL file, one row per call: argv, stdin, the CORNERMAN_* env
// A save goes through the real save.mjs, so the record is what a worker writes.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SAVE = fileURLToPath(new URL("../../plugin/scripts/save.mjs", import.meta.url));
const HOOK = fileURLToPath(new URL("../../plugin/scripts/post-tool.mjs", import.meta.url));
const log = process.env.FAKE_LOG;
const plan = JSON.parse(readFileSync(process.env.FAKE_PLAN, "utf8"));
const n = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean).length : 0;
const step = plan[n] ?? {};
const stdin = readFileSync(0, "utf8");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith("CORNERMAN_")));
appendFileSync(log, JSON.stringify({ argv: process.argv.slice(2), stdin, env }) + "\n");

if (step.pause) {
  const argv = process.argv.slice(2);
  const flag = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
  const sid = flag("--resume") ?? flag("--session-id");
  const transcript = `${log}.${sid}.jsonl`;
  const u = { input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: step.pause - 10, output_tokens: 5 };
  appendFileSync(transcript, JSON.stringify({ type: "assistant", message: { model: "claude-x", usage: u } }) + "\n");
  const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ session_id: sid, transcript_path: transcript }), encoding: "utf8", env: process.env });
  process.stdout.write(JSON.stringify({ type: "hook", out: r.stdout }) + "\n");
}
if (step.commit) execFileSync("git", ["commit", "--allow-empty", "-q", "-m", `call ${n + 1}`], { stdio: "ignore" });
if (step.save) {
  const r = spawnSync(process.execPath, [SAVE, "--title", `call ${n + 1}`], { input: `next: step ${n + 2}`, encoding: "utf8", env: process.env });
  if (r.status !== 0) process.stderr.write(r.stderr);
}
if (step.cost != null) process.stdout.write(JSON.stringify({ type: "result", total_cost_usd: step.cost }) + "\n");
process.exit(step.exit ?? 0);
