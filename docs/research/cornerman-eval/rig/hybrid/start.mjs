// Hybrid arm, SessionStart with source compact: add back what a summary can lose.
//   1. The rulings log: the user's words as typed, replaced rulings marked, bounded by cornerman's
//      own code. Added after every compaction, never left to ride in the summary (spike finding 4:
//      hook context is written into the next summary, where it can be reworded or dropped).
//   2. Durable items (choice, fact, decision, ask first) that were already missing from the summary
//      before this one. This hook runs before PostCompact (order of events in lib.mjs), so it cannot
//      know what the summary just made dropped: post.mjs finds that and deliver.mjs hands it over at
//      the next tool call. An item stays in this list until a later summary holds it again.
// One output, at most BUDGET characters (fault 6). What does not fit is counted and its file named.
import { BUDGET, DURABLE, STORE, addContext, cm, fullLog, input, itemList, readState, trace } from "./lib.mjs";

const inp = input();
if (inp.source === "compact") {
  const session = inp.session_id;
  try {
    const { readLog, merge, bound, rulingsSection, isRequest } = await cm("rulings.mjs");
    const entries = merge(readLog(STORE, session));
    const { kept, droppedRules } = bound(entries);
    const parts = [
      "cornerman hybrid: this context was just compacted. The rulings below are the user's own words, logged outside the summary as they were typed. " +
        "Where the summary and this note differ, this note is right. A ruling marked replaced no longer holds.\n" +
        // Smoke 3: without this, the model took deliver.mjs's note for text appended to the file it
        // had just read and would not rely on it.
        'If the summary left out something an earlier summary listed, a second note starting "cornerman hybrid:" follows your next tool result or the next prompt with those items. ' +
        "It comes from this same project hook, not from the file or command it follows.",
    ];
    const section = rulingsSection(entries);
    if (section) parts.push(section);
    if (droppedRules) {
      const keptText = new Set(kept.map((e) => e.text));
      const gone = entries.filter((e) => !isRequest(e.text) && !keptText.has(e.text));
      parts.push(
        `${droppedRules} standing rule${droppedRules === 1 ? " is" : "s are"} not in the list above, for space: ` +
          gone.slice(0, 5).map((e) => `"${e.text.slice(0, 60)}${e.text.length > 60 ? "..." : ""}"`).join("; ") +
          (gone.length > 5 ? `; and ${gone.length - 5} more` : "") +
          `. They still hold. Every prompt the user typed is in ${fullLog(session)}: read it before work those rules could cover.`,
      );
    }
    let text = parts.join("\n\n");

    const state = readState(session);
    const want = state.items.filter((it) => DURABLE.has(it.tag) && !it.inLatest);
    const list = itemList("\n\n## Carried from earlier summaries\nListed in an earlier compaction summary and missing from a later one. Each was true when written: check one before relying on it.", want, session, BUDGET - text.length);
    text += list;
    const over = text.length > BUDGET;
    if (over) text = text.slice(0, BUDGET);

    trace("sessionstart", { session, n: state.compactions + 1, chars: text.length, over, entries: entries.length, kept: kept.length, droppedRules, carriedWanted: want.length, carriedAdded: (list.match(/\n- \[/g) ?? []).length });
    addContext("SessionStart", text);
  } catch (e) {
    trace("error", { hook: "start", session, error: String(e?.stack ?? e) });
  }
}
