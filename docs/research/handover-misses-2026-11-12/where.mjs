// For each unmatched silent /clear, show the same-repo handovers saved in the prior 30 min:
// when each was archived, by which owner, and how (hook = loaded by a session start).
const times = process.argv.slice(2);
const store = await import("../../../plugin/packages/store/store.mjs");
const all = store.listAll(store.storeRoot());
const tail = (p) => String(p || "").split(/[/]|\u005c/).pop();
for (const arg of times) {
  const [ts, repo] = arg.split("|");
  const t = Date.parse(ts + ":00Z");
  console.log(`== /clear ${ts} in ${repo}`);
  for (const h of all) {
    const c = Date.parse(h.createdAt);
    if (c > t + 60e3 || c < t - 30 * 60e3 || tail(h.repoPath) !== repo) continue;
    const delta = h.archivedAt ? Math.round((Date.parse(h.archivedAt) - t) / 1000) : null;
    console.log(`   saved ${h.createdAt.slice(11, 19)} owner ${h.owner} | archived ${delta === null ? "never" : delta + "s vs clear"} via ${h.archivedBy?.via} by ${h.archivedBy?.owner} | ${String(h.title).slice(0, 50)}`);
  }
}
