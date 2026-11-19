// Hybrid arm prototype (STRESS-TEST-DESIGN.md, build step 1): native auto-compact plus four hooks.
// Shared by prompt.mjs, pre.mjs, post.mjs and start.mjs. No model call anywhere in these hooks.
//
// What the hybrid adds to native compaction:
//   prompt.mjs   UserPromptSubmit  logs the user's words with cornerman's own rulings code
//   pre.mjs      PreCompact        stdout = extra instructions for the summariser (a tagged list)
//   start.mjs    SessionStart      after a compaction: the rulings log, and durable items that were
//                                  already missing from the summary before this one
//   post.mjs     PostCompact       saves the summary, files its tagged items, checks it against the
//                                  log, and leaves what this summary dropped for the next hook
//   deliver.mjs  PostToolUse       hands the model what the latest summary dropped, once
//                                  (prompt.mjs does the same when a prompt comes first)
//
// The rulings and "mentioned" logic is imported from a cornerman checkout (CM_LIB), not copied, so
// the hybrid and the cm arm log, mark and bound the user's words with the same code.
//   CM_LIB        cornerman's plugin/scripts/lib (default ~/cornerman-src/plugin/scripts/lib)
//   HYBRID_STORE  where the log, summaries and state live (default ~/.cornerman-hybrid)
import { appendFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

export const STORE = process.env.HYBRID_STORE || join(homedir(), ".cornerman-hybrid");
export const CM_LIB = process.env.CM_LIB || join(homedir(), "cornerman-src", "plugin", "scripts", "lib");
// One SessionStart hook output over 10,000 characters is cut to a 2KB preview (rig/spike/captest.mjs).
// Same budget as cornerman's start-parts.mjs.
export const BUDGET = 9_000;

export const cm = (file) => import(pathToFileURL(join(CM_LIB, file)).href);
export const safe = (id) => String(id ?? "").replace(/[^A-Za-z0-9_-]/g, "");
export function input() {
  try { return JSON.parse(readFileSync(0, "utf8")); } catch { return {}; }
}
function put(file, text, flag) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text, { flag });
}
export const save = (file, text) => put(file, text, "w");
export const trace = (name, row) => { mkdirSync(join(STORE, "trace"), { recursive: true }); appendFileSync(join(STORE, "trace", `${name}.jsonl`), JSON.stringify({ at: new Date().toISOString(), ...row }) + "\n"); };

// Every prompt the user typed, uncut: cornerman's log file is cut to its bound once it passes 32KB,
// so a standing rule the bound dropped would otherwise exist nowhere. start.mjs points here.
export const fullLog = (session) => join(STORE, "prompts", `${safe(session)}.jsonl`);
export const summaryPath = (session, n) => join(STORE, "summaries", `${safe(session)}-${n}.md`);
export const carriedPath = (session) => join(STORE, "carried", `${safe(session)}.md`);

// post.mjs's state per session: { compactions, items: [{ tag, text, first, last, inLatest }] }.
// Only post.mjs writes it.
const statePath = (session) => join(STORE, "state", `${safe(session)}.json`);
export function readState(session) {
  try { return { compactions: 0, items: [], ...JSON.parse(readFileSync(statePath(session), "utf8")) }; } catch { return { compactions: 0, items: [] }; }
}
export const writeState = (session, state) => save(statePath(session), JSON.stringify(state, null, 1));

// Order of events at a compaction, measured in smokes 1 and 2 (CLI 2.1.316): PreCompact, the
// summary is made, SessionStart (source compact) runs to its end, then PostCompact, and only then
// is the summary written to the transcript. So SessionStart can never see the latest summary.
// What the latest summary dropped is known to post.mjs alone, which leaves it here; the next
// PostToolUse or UserPromptSubmit hook hands it to the model once (deliver.mjs, prompt.mjs).
// PostToolUse matters because auto compaction fires in the middle of a turn (spike finding 2).
const pendingPath = (session) => join(STORE, "pending", `${safe(session)}.json`);
export const setPending = (session, items) => (items.length ? save(pendingPath(session), JSON.stringify(items)) : rmSync(pendingPath(session), { force: true }));
/** The pending items, taken: a second call returns []. */
export function takePending(session) {
  const taken = `${pendingPath(session)}.${process.pid}`;
  try {
    renameSync(pendingPath(session), taken);
    const items = JSON.parse(readFileSync(taken, "utf8"));
    rmSync(taken, { force: true });
    return items;
  } catch { return []; }
}

/** `lead`, then as many "- [tag] text" lines as fit in BUDGET with it; the rest counted, with their file. */
export function itemList(lead, items, session, room = BUDGET) {
  if (!items.length) return "";
  const tail = (left) => `\n${left} more left out for space; all are in ${carriedPath(session)}.`;
  const lines = [];
  for (const [i, it] of items.entries()) {
    const line = `\n- [${it.tag}] ${it.text}`;
    const left = items.length - i - 1;
    if (lead.length + lines.join("").length + line.length + (left ? tail(left).length : 0) > room) break;
    lines.push(line);
  }
  const left = items.length - lines.length;
  return lead + lines.join("") + (left ? tail(left) : "");
}

/** The JSON a hook prints to add context for the model. "" in, nothing out. */
export const addContext = (event, text) => { if (text) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } })); };

/** For deliver.mjs and prompt.mjs: hand over what the latest summary dropped, once. */
export function deliver(event, session) {
  const items = takePending(session);
  const text = itemList(
    "cornerman hybrid: the compaction summary above left out these items that an earlier summary listed. Each was true when written: check one before relying on it.",
    items, session,
  );
  if (items.length) trace("deliver", { session, event, items: items.length, chars: text.length });
  addContext(event, text);
}

// The tags pre.mjs asks for. Durable ones are re-added by start.mjs when a later summary drops them.
// "rule" is not: the rulings log has the user's rules word for word and marks the replaced ones, and
// an old summary's wording of a rule could bring a replaced rule back. "in flight" is not: it is
// state, and only the latest summary's account of it can be right.
export const TAGS = ["rule", "choice", "fact", "decision", "in flight", "ask first"];
export const DURABLE = new Set(["choice", "fact", "decision", "ask first"]);
export const SECTION = "Carried forward";

const ITEM = new RegExp(`^\\s*(?:[-*+]|\\d+[.)])\\s*\\**\\[(${TAGS.join("|")})\\]\\**\\s*(.+?)\\s*$`, "i");
/** The tagged items of a summary's "Carried forward" section: [{ tag, text }]. [] when it has none. */
export function carriedItems(summary) {
  const out = [];
  let inside = false;
  for (const line of String(summary ?? "").replace(/\r\n/g, "\n").split("\n")) {
    const bare = line.replace(/^[\s#>*\d.)-]+|[\s*:]+$/g, "");
    if (bare.toLowerCase() === SECTION.toLowerCase()) { inside = true; continue; }
    if (!inside) continue;
    if (/^\s*#{1,6}\s/.test(line) || /^\s*<\/?summary>/.test(line)) { inside = false; continue; }
    const m = ITEM.exec(line);
    if (m) out.push({ tag: m[1].toLowerCase(), text: m[2] });
  }
  return out;
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const sameText = (a, b) => norm(a) === norm(b);
/**
 * Whether `text` still holds an item. cornerman's `mentioned` passes on 60% of the significant
 * words, which a changed value survives ("the staging port is 4417" against "... is 5521"). So
 * every word of the item that carries a digit must be in the text as well.
 */
export function held(item, text, { mentioned, words }) {
  if (!mentioned(item, text)) return false;
  const have = new Set(words(text));
  return words(item.text).filter((w) => /\d/.test(w)).every((w) => have.has(w));
}
