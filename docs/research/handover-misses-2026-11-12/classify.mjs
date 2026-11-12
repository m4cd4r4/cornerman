// For each miss session that the user started with "Continue from the cornerman handover",
// find the session in the same project folder that ended just before it, and report
// whether that session saved a handover (save.mjs), with --cwd, or never saved one.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
const root = process.argv[2];
const misses = readFileSync(process.argv[3], "utf8").trim().split("\n").map((p) => join(root, p));
const parse = (f) => readFileSync(f, "utf8").split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const text = (e) => { const c = e.message?.content; return typeof c === "string" ? c : Array.isArray(c) ? c.map((x) => x.text || (x.input ? JSON.stringify(x.input) : "")).join(" ") : ""; };
const rows = [];
for (const f of misses) {
  const L = parse(f);
  const firstUser = L.find((e) => e.type === "user" && !text(e).startsWith("<") && text(e).trim());
  const first = firstUser ? text(firstUser) : "";
  const start = L.find((e) => e.timestamp)?.timestamp;
  if (!/continue from the cornerman handover/i.test(first)) continue;
  // previous session in same folder: latest last-timestamp before this start
  const dir = dirname(f);
  let prev = null, prevEnd = "";
  for (const g of readdirSync(dir).filter((n) => n.endsWith(".jsonl"))) {
    const p = join(dir, g); if (p === f) continue;
    if (Math.abs(statSync(p).mtimeMs - Date.parse(start)) > 3 * 86400e3) continue;
    const G = parse(p); const last = G.filter((e) => e.timestamp).at(-1)?.timestamp || "";
    if (last && last <= start && last > prevEnd) { prevEnd = last; prev = G; }
  }
  let kind = "no-prev-found";
  if (prev) {
    const saves = prev.filter((e) => e.type === "assistant").map(text).filter((t) => /save\.mjs/.test(t));
    const gapMin = Math.round((Date.parse(start) - Date.parse(prevEnd)) / 60000);
    if (!saves.length) kind = `prev-no-save (gap ${gapMin}m)`;
    else if (saves.some((t) => /--cwd/.test(t))) kind = `prev-saved-with---cwd (gap ${gapMin}m)`;
    else kind = `prev-saved-here (gap ${gapMin}m)`;
  }
  rows.push(`${start?.slice(0, 16)} ${basename(dir).slice(0, 28)} ${kind}`);
}
console.log(rows.sort().join("\n"));
console.log("total:", rows.length);
