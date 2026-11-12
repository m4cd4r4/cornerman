// Across every /clear in the last 14 days: how many had SessionStart hooks cancelled,
// split by whether cornerman's line reached the session.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const root = process.argv[2];
const since = Date.now() - 14 * 86400e3;
const tally = {};
const slowest = [];
for (const d of readdirSync(root)) {
  const dir = join(root, d);
  let files; try { files = readdirSync(dir).filter((n) => n.endsWith(".jsonl")); } catch { continue; }
  for (const n of files) {
    const p = join(dir, n);
    if (statSync(p).mtimeMs < since) continue;
    const lines = readFileSync(p, "utf8").split("\n").slice(0, 80);
    const head = lines.join("\n");
    if (!head.includes("<command-name>/clear</command-name>")) continue;
    const fa = lines.findIndex((l) => l.includes('"type":"assistant"'));
    const start = (fa < 0 ? lines : lines.slice(0, fa)).join("\n");
    const ts = (start.match(/"timestamp":"([^"]+)"/) || [])[1] || "";
    if (Date.parse(ts) < since) continue;
    const cm = /(cornerman|clear-resume): loaded handover/.test(start) ? "loaded" : start.includes("none loaded") ? "none-loaded" : "silent";
    const cancelled = (start.match(/"hook_cancelled"/g) || []).length;
    const durs = [...start.matchAll(/"durationMs":(\d+)/g)].map((m) => +m[1]);
    const max = durs.length ? Math.max(...durs) : 0;
    const k = `${cm} / ${cancelled ? "hooks cancelled" : "no cancel"}`;
    tally[k] = (tally[k] || 0) + 1;
    slowest.push(max);
  }
}
console.log(tally);
slowest.sort((a, b) => a - b);
const q = (f) => slowest[Math.floor(f * (slowest.length - 1))];
console.log({ slowestHookMs_median: q(0.5), p90: q(0.9), max: q(1) });
