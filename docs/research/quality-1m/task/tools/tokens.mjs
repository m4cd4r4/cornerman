// tokens.mjs: work-token timeline of one run, from its Claude Code transcripts.
// tdd-guard:allow - research scorer, proven by tools/score-selftest.mjs.
// "Work tokens" at time t = for every session so far, its first context size plus every later
// increase of context size (a compaction drop is not work; the growth after it is). This is the
// material the agent has handled, comparable across arms that clear, compact or fill.
//   import { timeline, workAt } from "./tokens.mjs"
//   node tokens.mjs --transcripts <CLAUDE_CONFIG_DIR>/projects [--json]
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".jsonl") ? [p] : [];
  });
}

// One point per main-chain assistant message: { ts, session, ctx, compacted }.
export function points(transcripts) {
  const out = [];
  for (const f of walk(transcripts)) {
    if (/[\\/]subagents[\\/]/.test(f)) continue;
    const seen = new Set();
    let compacted = false;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      if (!line.trim()) continue;
      let j;
      try { j = JSON.parse(line); } catch { continue; }
      if (j.isSidechain) continue;
      if (j.type === "system" && j.subtype === "compact_boundary") { compacted = true; continue; }
      if (j.type !== "assistant" || !j.message?.usage) continue;
      const id = j.message.id || j.uuid;
      if (seen.has(id)) continue;
      seen.add(id);
      const u = j.message.usage;
      const ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
      out.push({ ts: Date.parse(j.timestamp), session: j.sessionId, ctx, out: u.output_tokens || 0, compacted });
      compacted = false;
    }
  }
  return out.sort((a, b) => a.ts - b.ts);
}

// Adds cumulative work to each point; returns { points, sessions, compactions, peak, work }.
export function timeline(transcripts) {
  const pts = points(transcripts);
  const last = new Map();
  let work = 0, peak = 0, compactions = 0;
  for (const p of pts) {
    const prev = last.get(p.session);
    if (p.compacted) compactions++;
    work += prev === undefined ? p.ctx : Math.max(0, p.ctx - prev);
    last.set(p.session, p.ctx);
    peak = Math.max(peak, p.ctx);
    p.work = work;
  }
  return { points: pts, sessions: last.size, compactions, peak, work };
}

// Work tokens reached by time ts (the last point at or before it).
export function workAt(tl, ts) {
  let w = 0;
  for (const p of tl.points) { if (p.ts > ts) break; w = p.work; }
  return w;
}

if (process.argv[1] && process.argv[1].endsWith("tokens.mjs")) {
  const i = process.argv.indexOf("--transcripts");
  if (i === -1) throw new Error("need --transcripts");
  const tl = timeline(process.argv[i + 1]);
  const s = { sessions: tl.sessions, compactions: tl.compactions, peak: tl.peak, work: tl.work, messages: tl.points.length };
  console.log(process.argv.includes("--json") ? JSON.stringify(s) : Object.entries(s).map(([k, v]) => `${k} ${v}`).join("\n"));
}
