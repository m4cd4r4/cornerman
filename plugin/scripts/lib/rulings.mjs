// The rulings log: what the user said in chat reaches the handover in their own words.
//
// A headless clear in the quality-1m fill dial (2026-11-15) saved a handover that held
// none of the rules the user gave only in chat. The handover was the model's summary,
// the trail is tool calls, artifacts.md is file paths: nothing recorded what the user
// said. This does, without a model:
//
// - Capture: the UserPromptSubmit hook appends each prompt to
//   <store>/rulings/<session>.jsonl, one { at, text } row, the user's words as typed.
// - Store: one small file per session, a sibling of the handover records, so an
//   archive of the store (#210) takes it as it is.
// - Carry: save.mjs writes a "Rulings from the user" section into the handover from
//   this session's log plus the same section of the handover this one continues, so
//   the first clear has them (from the log) and every later one too (from the chain).
// - Bound: each entry, the section and the log file have caps (below).
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { words } from "./carry.mjs";

export const RULINGS_HEADING = "Rulings from the user";

const dirOf = (store) => join(store, "rulings");
const safeId = (id) => String(id ?? "").replace(/[^A-Za-z0-9_-]/g, "");
export const logPath = (store, session) => join(dirOf(store), `${safeId(session)}.jsonl`);
export const LOG_MAX = 32 * 1024;

// Prompts cornerman itself submits (hooks/relay.ts RESUME_TEXT, HANDOVER_TEXT and the
// idle asks), which are not the user's words even though they arrive as user prompts.
// The threshold ask too: since #215 the headless runner resumes with it as the user
// message, and without this it was logged as a user ruling and carried down the chain
// as one (cornerman-eval rig proof, 2026-11-16). Its head is nudge.mjs HEADLESS_MARK /
// ASK_MARK.
const OWN_PROMPTS = [
  /^Continue from the cornerman handover/i,
  /^Write a cornerman handover now/i,
  /^The user is away and the prompt cache/i,
  /^cornerman (headless|auto) mode \(/i,
];
// The headless runner resends the task with the handover after this line
// (lib/run.mjs resumePrompt, unfinishedPrompt): only the task before it is the user's.
const RUNNER_CUT = /\n\n---\n\ncornerman: this is segment \d+/;
// Blocks the harness puts in a user turn that the user did not type: background task and monitor
// notifications, reminders, another session's message, local command output, the IDE's open file
// or selection. The field audit of 2026-11-28 found 823 of 1,799 logged rulings (46%) were these,
// 818 of them <task-notification>. Text the user typed after a leading block is still theirs.
// Not listed, so kept: <pasted_content>, which is text the user pasted themselves.
const HARNESS_TAGS = [
  "task-notification",
  "system-reminder",
  "cross-session-message",
  "local-command-stdout",
  "local-command-caveat",
  "command-name",
  "command-message",
  "command-args",
  "bash-input",
  "bash-stdout",
  "bash-stderr",
  "ide_opened_file",
  "ide_selection",
].join("|");
const HARNESS_BLOCK = new RegExp(`^<(${HARNESS_TAGS})\\b[^>]*>[\\s\\S]*?</\\1>\\s*`, "i");
const HARNESS_OPEN = new RegExp(`^<(?:${HARNESS_TAGS})\\b`, "i");
/** The text after any leading harness blocks; "" when one is left open (cut before its close). */
function withoutHarness(text) {
  let t = text;
  for (let m; (m = HARNESS_BLOCK.exec(t)); ) t = t.slice(m[0].length);
  return HARNESS_OPEN.test(t) ? "" : t;
}
// A word that makes a short prompt a ruling rather than an acknowledgement.
const CUE = /\b(never|always|don'?t|do not|must|should|only|instead|prefer|use|keep|avoid|stop|no|not|rule|ruled|decided?|remember|without)\b/i;

/** The user's words in a prompt, or "" when it holds none worth a handover line. */
export function userWords(prompt) {
  const raw = String(prompt ?? "");
  const cut = RUNNER_CUT.exec(raw);
  const text = withoutHarness((cut ? raw.slice(0, cut.index) : raw).replace(/\s+/g, " ").trim());
  if (!text || text.startsWith("/") || text.startsWith("<command-")) return "";
  if (OWN_PROMPTS.some((re) => re.test(text))) return "";
  // "ok", "yes go", "continue": an answer whose question is not in the log says nothing.
  if (text.split(" ").length < 3 && !CUE.test(text)) return "";
  return text.length > ENTRY_MAX ? shorten(text) : text;
}

// One entry's cap. A pasted log or a long brief keeps only its sentences that carry a
// CUE word, whole and in order; with none, its opening. "[cut]" marks each gap.
export const ENTRY_MAX = 500;
const CUT = "[cut]";
function shorten(text) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const out = [];
  let len = 0;
  let last = -1;
  sentences.forEach((s, i) => {
    if (!CUE.test(s) || len + s.length + CUT.length + 2 > ENTRY_MAX) return;
    if (i !== last + 1) out.push(CUT);
    out.push(s);
    len += s.length + CUT.length + 2;
    last = i;
  });
  if (!out.length) return `${text.slice(0, ENTRY_MAX - CUT.length - 1).trimEnd()} ${CUT}`;
  if (last !== sentences.length - 1) out.push(CUT);
  return out.join(" ").slice(0, ENTRY_MAX);
}

/** Append one prompt to the session's log. Never throws. */
export function record(store, session, prompt, now = new Date()) {
  try {
    const id = safeId(session);
    const text = userWords(prompt);
    if (!id || !text) return false;
    mkdirSync(dirOf(store), { recursive: true });
    const file = logPath(store, id);
    appendFileSync(file, JSON.stringify({ at: now.toISOString(), text }) + "\n", "utf8");
    // Past LOG_MAX the file is cut to what the section would keep, so it stays a few KB.
    if (statSync(file).size > LOG_MAX)
      writeFileSync(file, bound(merge(readLog(store, id))).kept.map((e) => JSON.stringify(e) + "\n").join(""), "utf8");
    return true;
  } catch {
    return false;
  }
}

/** The session's logged entries, oldest first: [{ at, text }]. */
export function readLog(store, session) {
  try {
    const out = [];
    for (const line of readFileSync(logPath(store, session), "utf8").split("\n")) {
      try {
        const row = JSON.parse(line);
        // A log written before the harness filter (#222), or by a window still on an older
        // build, holds injected turns: drop them on the way out, as sectionEntries does.
        const text = row && typeof row.text === "string" ? withoutHarness(row.text) : "";
        if (text) out.push({ at: String(row.at ?? ""), text });
      } catch {
        // a blank or half-written line
      }
    }
    return out;
  } catch {
    return [];
  }
}

// The section's caps: about 1.5k tokens at most, read by every session in the chain.
export const MAX_ENTRIES = 40;
export const MAX_CHARS = 6000;

// A one-off task ("Add applyFee to src/money.js", "Carry on with the release script", "Next
// batch of reading ..."): it opens with a task verb and carries no rule word. Everything else is a
// standing rule or fact. Seed 7 of cornerman-eval Test 1 (2026-11-17) is why: the old cap dropped
// "plain" entries (no CUE word) oldest first, and "We agreed the API limit: 23 calls a minute"
// has no CUE word, so seven rules went while later task requests stayed. When in doubt an entry
// counts as a rule: listing a request too long costs a line, dropping a rule costs the rule.
const TASK =
  /^(?:please\s+|ok,?\s+|now\s+)?(?:add|implement|create|write|build|fix|change|make|refactor|set|update|remove|delete|rename|move|carry on|continue|next batch|read|run|start|finish|look|show|list|open|commit|push|install|deploy|draft|generate|convert|wire|port|review|explain|find|go ahead|try)\b/i;
const RULE_WORD = /\b(never|always|don'?t|do not|must|rule|from now on|every|whenever|actually|correction|ask me|check with me)\b/i;
// A correction ("Make that 3 spaces") opens with a task verb too, but it replaces a rule: listed as
// a request it was dropped first and the old rule came back unmarked. So does a standing imperative
// ("Run the linter before every commit", "Add a retry. Use single quotes only."), hence the CUE
// words (reviewer, 2026-11-18).
export const isRequest = (text) => TASK.test(text) && !RULE_WORD.test(text) && !CUE.test(text) && !CORRECTION.test(text);

// A correction of an earlier ruling: "Actually make that 3 spaces.", "Correction on the licence
// line: ISC, not MIT", "Actually, switch to double quotes". Seed 7 kept MIT, 2 spaces and single
// quotes unmarked next to these, and all 24 reversed facts of the batch had the old wording in view.
// "switch to" and the like count only at a sentence start (after an opener such as "Actually,"):
// "Never switch to yarn" is a rule of its own, and marked "Use pnpm" replaced (reviewer, 2026-11-18).
// "Never mind that", "Revised:" and "I've changed my mind" are the rig's own late corrections
// (cornerman-eval test1/facts.mjs): stage A left the old indent rule unmarked after them (fault 8).
const CORRECTION =
  /^(?:actually|correction|scratch that|change of plan|on second thought|(?:i'?ve |i have )?changed my mind)\b|^(?:never ?mind(?: that)?|revised)\s*[.,:]|^never ?mind (?:the|that|my) [\w -]*?\brules?\b|(?:^|[.!?:]\s+|^(?:actually|ok|so|no),?\s+)(?:switch to|make that|change that to)\b/i;
// The correction's own words, which say that it corrects, not what.
const CORRECTION_WORDS = new Set(words("actually correction scratch change changed plan second thought switch make that instead later never mind revised"));
// Words that name the same setting without sharing a word: "tabs it is" replaces "Use 3-space
// indents", and "use 2 spaces for indentation" replaces "indent with tabs" (fault 8). Each match
// adds its topic as one shared word. "tab" alone is shorter than words() keeps. "Tabs" is
// indentation unless the sentence is about a browser's tabs or the tab bar, key or shortcut: three
// set phrases missed "Switch to tabs." and "Make that tabs." (second review, 2026-11-19).
const INDENT = /\b(?:indent\w*|\d+[- ]?spaces?|(?:two|three|four)[- ]spaces?)\b/i;
const NOT_INDENT_TAB = /\b(?:browser|window|tabs? (?:bar|key|shortcut))\b/i;
const TOPICS = [["§indent", (text) => INDENT.test(text) || (/\btabs\b/i.test(text) && !NOT_INDENT_TAB.test(text))]];
const topicWords = (text) => [...words(text), ...TOPICS.filter(([, is]) => is(text)).map(([t]) => t)];
export const REPLACED = "(replaced by a later one)";
// A prompt can hold several rules, and a correction replaces one of them: "the API limit is 23
// calls a minute. Use single quotes." stays a rule for its first sentence (plugin sandbox, 2026-11-18).
export const PART_REPLACED = "(partly replaced by a later one)";
const sentenceCount = (text) => text.split(/(?<=[.!?])\s+/).filter((s) => words(s).length).length;

/**
 * The entries with `replaced` set on each ruling a later correction replaces: the earlier rule
 * sharing the most significant words with it (the latest on a tie), none when no word is shared.
 * `replaced` is "whole" for a one-sentence entry and "part" for one holding more.
 */
export function markReplaced(entries) {
  const out = entries.map((e) => ({ ...e, replaced: false }));
  out.forEach((e, i) => {
    if (!CORRECTION.test(e.text)) return;
    // A bare number is what a correction changes ("make that 3"), not what it is about: in seed 7
    // "3 spaces" matched "steps 2 and 3" of the release script on it.
    const want = new Set(topicWords(e.text).filter((w) => !CORRECTION_WORDS.has(w) && !/^\d+$/.test(w)));
    let best = -1;
    let most = 0;
    for (let j = 0; j < i; j++) {
      const o = out[j];
      if (o.replaced === "whole" || isRequest(o.text)) continue;
      const shared = new Set(topicWords(o.text).filter((w) => want.has(w))).size;
      if (shared >= most && shared > 0) [best, most] = [j, shared];
    }
    if (best > -1) out[best].replaced = sentenceCount(out[best].text) > 1 ? "part" : "whole";
  });
  return out;
}

/**
 * At most MAX_ENTRIES entries and MAX_CHARS of text, in order. Over the cap, task requests go
 * first, then rulings a later one replaced, oldest first. Standing rules go only when the rules
 * alone are over the cap, oldest first, and are counted apart so the section says so: a rule never
 * drops out silently. Returns { kept, dropped, droppedReplaced, droppedRules }.
 */
export function bound(entries) {
  const kept = markReplaced(entries);
  let chars = kept.reduce((n, e) => n + e.text.length, 0);
  let dropped = 0;
  let droppedReplaced = 0;
  let droppedRules = 0;
  while (kept.length > MAX_ENTRIES || (chars > MAX_CHARS && kept.length > 1)) {
    const req = kept.findIndex((e) => isRequest(e.text));
    const old = req < 0 ? kept.findIndex((e) => e.replaced === "whole") : -1;
    const [gone] = kept.splice(Math.max(req, old, 0), 1);
    chars -= gone.text.length;
    if (req > -1) dropped++;
    else if (old > -1) droppedReplaced++;
    else droppedRules++;
  }
  return { kept, dropped, droppedReplaced, droppedRules };
}

/** The section's markdown, or "" when there is nothing to list. */
export function rulingsSection(entries) {
  const { kept, dropped, droppedReplaced, droppedRules } = bound(entries);
  if (!kept.length) return "";
  // Two lists, so a rule never reads as a task that may be done. The old single list said "Some
  // may be requests already done", and seed 7's final session treated its rules that way.
  const line = (e) => `- ${e.at ? `[${e.at.slice(0, 10)}] ` : ""}"${e.text}"${e.replaced ? ` ${e.replaced === "part" ? PART_REPLACED : REPLACED}` : ""}`;
  const rules = kept.filter((e) => !isRequest(e.text));
  const requests = kept.filter((e) => isRequest(e.text));
  return (
    `## ${RULINGS_HEADING}\n` +
    `What the user typed in this chain, in their own words, oldest first; saving adds these.` +
    (dropped ? ` ${dropped} older task request${dropped === 1 ? "" : "s"} left out to keep this short.` : "") +
    (droppedReplaced ? ` ${droppedReplaced} replaced ruling${droppedReplaced === 1 ? "" : "s"} left out.` : "") +
    (droppedRules ? ` ${droppedRules} oldest standing rule${droppedRules === 1 ? "" : "s"} left out for space: restate any that still holds.` : "") +
    (rules.length ? `\nStanding rules: each holds for all later work unless a later one replaces it.\n${rules.map(line).join("\n")}` : "") +
    (requests.length ? `\nTask requests, one-off asks: check whether each is done before acting on it.\n${requests.map(line).join("\n")}` : "")
  );
}

/** The body with its rulings section replaced by `section` (or removed when it is ""). */
export function withRulings(body, section) {
  const lines = String(body).replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let skip = false;
  for (const line of lines) {
    if (/^##\s+/.test(line)) skip = new RegExp(`^##\\s+${RULINGS_HEADING}\\s*$`, "i").test(line);
    else if (/^#\s/.test(line)) skip = false;
    if (!skip) out.push(line);
  }
  const own = out.join("\n").trimEnd();
  return section ? `${own}\n\n${section}` : own;
}

/** The entries of a handover's rulings section, oldest first: [{ at, text }]. */
export function sectionEntries(body) {
  const out = [];
  let inside = false;
  for (const line of String(body ?? "").replace(/\r\n/g, "\n").split("\n")) {
    if (/^#{1,2}\s/.test(line)) {
      inside = new RegExp(`^##\\s+${RULINGS_HEADING}\\s*$`, "i").test(line);
      continue;
    }
    // The replaced mark is worked out again on every save, so it is not part of the text.
    const m = inside && /^- (?:\[([0-9-]+)\] )?"(.*)"(?: \((?:partly )?replaced by a later one\))?\s*$/.exec(line);
    // Handovers saved before the harness filter carry injected turns: drop them on the way in.
    const text = m && withoutHarness(m[2]);
    if (text) out.push({ at: m[1] ?? "", text });
  }
  return out;
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Previous entries then new ones, each text once (its first, oldest, occurrence). */
export function merge(...lists) {
  const seen = new Set();
  const out = [];
  for (const e of lists.flat()) {
    const k = norm(e.text);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

/** The texts of this chain's rulings a later correction replaced whole, for carry.mjs. Never throws. */
export function replacedRulings({ store, session, previous }) {
  try {
    return markReplaced(merge(sectionEntries(previous), readLog(store, session)))
      .filter((e) => e.replaced === "whole")
      .map((e) => e.text);
  } catch {
    return [];
  }
}

/**
 * The body with a rulings section from the handover it continues (`previous`, its
 * body) and this session's log. Any section the model wrote is replaced: the log is
 * exact. Never throws: on a failure the body comes back as it was.
 */
export function addRulings(body, { store, session, previous }) {
  try {
    return withRulings(body, rulingsSection(merge(sectionEntries(previous), readLog(store, session))));
  } catch {
    return body;
  }
}
