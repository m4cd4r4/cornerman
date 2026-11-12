// Match each silent /clear (cornerman line absent from the transcript) to a handover the
// hook archived within 2 minutes of the session start. Unmatched ones = truly nothing loaded.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const root = process.argv[2];
const since = Date.now() - 14 * 86400e3;
const silent = [];
for (const d of readdirSync(root)) {
  const dir = join(root, d);
  let files; try { files = readdirSync(dir).filter((n) => n.endsWith(".jsonl")); } catch { continue; }
  for (const n of files) {
    const p = join(dir, n);
    if (statSync(p).mtimeMs < since) continue;
    const lines = readFileSync(p, "utf8").split("\n").slice(0, 60);
    if (!lines.join("\n").includes("<command-name>/clear</command-name>")) continue;
    const fa = lines.findIndex((l) => l.includes('"type":"assistant"'));
    const start = (fa < 0 ? lines : lines.slice(0, fa)).join("\n");
    const ts = (start.match(/"timestamp":"([^"]+)"/) || [])[1] || "";
    if (Date.parse(ts) < since) continue;
    if (/(cornerman|clear-resume): loaded handover/.test(start) || start.includes("none loaded")) continue;
    const firstUser = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .find((e) => e?.type === "user" && typeof e.message?.content === "string" && !e.message.content.startsWith("<"));
    silent.push({ ts, d, first: (firstUser?.message?.content || "").slice(0, 70).replace(/\s+/g, " ") });
  }
}
const store = await import("../../../plugin/packages/store/store.mjs");
const all = store.listAll(store.storeRoot());
let matched = 0;
const un = [];
for (const s of silent) {
  const t = Date.parse(s.ts);
  const hit = all.find((h) => h.archivedAt && h.archivedBy?.via === "hook" && Math.abs(Date.parse(h.archivedAt) - t) < 120e3);
  if (hit) { matched++; continue; }
  const prior = all.filter((h) => { const c = Date.parse(h.createdAt); return c < t + 60e3 && c > t - 30 * 60e3; })
    .map((h) => `${String(h.repoPath || "").split("/").pop().split(String.fromCharCode(92)).pop()}:${h.status}`);
  un.push(`${s.ts.slice(0, 16)} ${s.d.slice(0, 34)} | first: ${s.first} | saved prior 30m: ${prior.join(", ") || "none"}`);
}
console.log({ silent: silent.length, matchedToLoad: matched, unmatched: un.length });
console.log(un.sort().join("\n"));
