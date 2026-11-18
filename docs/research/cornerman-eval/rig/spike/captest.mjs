#!/usr/bin/env node
// Cap test (PROJECT-PLAN.md, stage A fault 6): at what size does Claude Code replace a SessionStart
// hook's output with a 2KB preview? Stub API, no model call. For each case a fresh `claude -p` runs
// with one or two SessionStart hooks that print exactly N characters ending in an end marker; the
// stub logs the request the model would get. Whole = the end marker is in the request. Cut = the
// request says "Output too large".
//   node /rig/spike/captest.mjs            (inside the cornerman-eval container, CM_INSTALL=0)
// Writes /out/captest.json and prints one line per case.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const OUT = "/out", LOG = join(OUT, "stub.jsonl"), S = join(homedir(), ".claude", "settings.json");
const KEY = "sk-ant-stub-not-a-key";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The hook: prints exactly N characters of `unit`, the last ones being the marker. mode json wraps
// them in hookSpecificOutput.additionalContext (N counts the context text, not the JSON around it).
writeFileSync("/tmp/gen.mjs", `
const [n, mode, unit, marker] = process.argv.slice(2);
const body = unit.repeat(Math.ceil(Number(n) / unit.length)).slice(0, Number(n) - marker.length) + marker;
process.stdout.write(mode === "json" ? JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: body } }) : body);
`);

let url = "";
async function startStub() {
  writeFileSync(LOG, "");
  const p = spawn("node", ["/harness/stub-api.mjs", "--log", LOG], { stdio: ["ignore", "pipe", "ignore"] });
  p.stdout.on("data", (d) => { const m = /http:\/\/\S+/.exec(String(d)); if (m) url = m[0]; });
  for (let i = 0; i < 50 && !url; i++) await sleep(100);
  if (!url) throw new Error("stub did not start");
}

let caseNo = 0;
function run(hooks) {
  // hooks: [{ n, mode, unit }]
  const id = ++caseNo;
  const cmds = hooks.map((h, i) => ({ ...h, marker: `ENDMARK-${id}-${i}` }));
  mkdirSync(join(homedir(), ".claude"), { recursive: true });
  writeFileSync(S, JSON.stringify({ hooks: { SessionStart: cmds.map((h) => ({ hooks: [{ type: "command", command: `node /tmp/gen.mjs ${h.n} ${h.mode} ${h.unit} ${h.marker}` }] })) } }));
  writeFileSync(LOG, "");
  const r = spawnSync("claude", ["-p", "hi", "--model", "sonnet"], { cwd: "/work", encoding: "utf8", timeout: 120_000, env: { ...process.env, ANTHROPIC_BASE_URL: url, ANTHROPIC_API_KEY: KEY } });
  const req = existsSync(LOG) ? readFileSync(LOG, "utf8") : "";
  const whole = cmds.map((h) => req.includes(h.marker));
  const cut = [...req.matchAll(/Output too large \(([0-9.]+ ?[KM]?B)\)/g)].map((m) => m[1]);
  return { hooks, whole, cut, requests: req.split("\n").filter(Boolean).length, exit: r.status, stderr: (r.stderr || "").slice(0, 200) };
}

// Largest N that arrives whole, by bisection, for one hook of the given mode and unit.
function bisect(mode, unit, lo, hi, results) {
  const at = (n) => { const r = run([{ n, mode, unit }]); results.push(r); console.log(JSON.stringify(r)); return r.whole[0] && !r.cut.length; };
  if (!at(lo)) return { error: `not whole at ${lo}` };
  if (at(hi)) return { error: `still whole at ${hi}` };
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (at(mid)) lo = mid; else hi = mid; }
  return { lastWhole: lo, firstCut: hi };
}

async function main() {
  mkdirSync("/work", { recursive: true });
  await startStub();
  const R = { cases: [], bisect: {} };
  const one = (label, hooks) => { const r = { label, ...run(hooks) }; R.cases.push(r); console.log(JSON.stringify(r)); };
  // A known-good and a known-bad case first: the check must see both.
  one("control small plain", [{ n: 500, mode: "plain", unit: "a" }]);
  one("control small json", [{ n: 500, mode: "json", unit: "a" }]);
  one("control large plain", [{ n: 40000, mode: "plain", unit: "a" }]);
  R.bisect.plainAscii = bisect("plain", "a", 2000, 40000, R.cases);
  R.bisect.jsonAscii = bisect("json", "a", 2000, 40000, R.cases);
  // Two-byte characters: if the cap counts bytes, the limit in characters halves.
  R.bisect.plainTwoByte = bisect("plain", "é", 1000, 40000, R.cases);
  R.bisect.jsonTwoByte = bisect("json", "é", 1000, 40000, R.cases);
  // Per hook or in total: two hooks, each under the single-hook limit, together over it.
  const lim = R.bisect.jsonAscii.lastWhole ?? R.bisect.plainAscii.lastWhole ?? 10000;
  const part = Math.floor(lim * 0.7);
  one("two json hooks, each 70% of the limit", [{ n: part, mode: "json", unit: "a" }, { n: part, mode: "json", unit: "b" }]);
  one("two plain hooks, each 70% of the limit", [{ n: part, mode: "plain", unit: "a" }, { n: part, mode: "plain", unit: "b" }]);
  one("three json hooks, each 70% of the limit", [{ n: part, mode: "json", unit: "a" }, { n: part, mode: "json", unit: "b" }, { n: part, mode: "json", unit: "c" }]);
  one("one over, one under", [{ n: lim + 2000, mode: "json", unit: "a" }, { n: 500, mode: "json", unit: "b" }]);
  writeFileSync(join(OUT, "captest.json"), JSON.stringify(R, null, 1));
  console.log("BISECT " + JSON.stringify(R.bisect));
  process.exit(0);
}
main().catch((e) => { console.error(e.stack); writeFileSync(join(OUT, "captest-error.txt"), String(e.stack)); process.exit(1); });
