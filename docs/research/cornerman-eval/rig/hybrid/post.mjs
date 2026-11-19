// Hybrid arm, PostCompact: the input carries the whole summary (spike, 2026-11-18). Save it, file
// its tagged items, mark which earlier items it still holds, and check it against the rulings log.
// The trace row is the "carried" score of the stress test for this arm: which standing rules the
// summary itself kept, before start.mjs adds the log back.
import { DURABLE, STORE, carriedItems, carriedPath, cm, held, input, readState, save, sameText, setPending, summaryPath, trace, writeState } from "./lib.mjs";

const inp = input();
const session = inp.session_id;
try {
  const summary = String(inp.compact_summary ?? "");
  const carry = await cm("carry.mjs");
  const { readLog, merge, markReplaced, isRequest } = await cm("rulings.mjs");
  const state = readState(session);
  const n = ++state.compactions;
  save(summaryPath(session, n), summary);

  const found = carriedItems(summary);
  const lost = [];
  for (const it of state.items) {
    const was = it.inLatest;
    it.inLatest = held(it, summary, carry);
    if (it.inLatest) it.last = n;
    else if (was && DURABLE.has(it.tag)) lost.push({ tag: it.tag, text: it.text });
  }
  setPending(session, lost);
  // Each summary rewords the items it copies (smoke 1: 15 items became 29 in two compactions). An
  // item of the same tag that holds the new one, and is held by it, is the same item: keep the
  // newer wording.
  const taken = new Set();
  for (const f of found) {
    const twin = state.items.find((it) => !taken.has(it) && it.tag === f.tag && (sameText(it.text, f.text) || (held(it, f.text, carry) && held(f, it.text, carry))));
    if (twin) { taken.add(twin); Object.assign(twin, { text: f.text, last: n, inLatest: true }); continue; }
    const fresh = { ...f, first: n, last: n, inLatest: true };
    taken.add(fresh);
    state.items.push(fresh);
  }
  writeState(session, state);
  save(carriedPath(session), state.items.map((it) => `- [${it.tag}] ${it.text} (summaries ${it.first}-${it.last})`).join("\n") + "\n");

  const rules = markReplaced(merge(readLog(STORE, session))).filter((e) => !e.replaced && !isRequest(e.text));
  const missing = rules.filter((e) => !held(e, summary, carry));
  trace("postcompact", {
    session, n, trigger: inp.trigger ?? null, summaryChars: summary.length,
    hasSection: found.length > 0, items: found.length, byTag: Object.fromEntries(found.map((f) => [f.tag, found.filter((g) => g.tag === f.tag).length])),
    earlierItemsDropped: state.items.filter((it) => !it.inLatest).map((it) => `[${it.tag}] ${it.text}`), pending: lost.length,
    rules: rules.length, rulesMissing: missing.map((e) => e.text),
  });
} catch (e) {
  trace("error", { hook: "post", session, error: String(e?.stack ?? e) });
}
