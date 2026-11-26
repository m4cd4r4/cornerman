import { statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
// Carry-forward: no open item drops out of a handover chain silently (#194).
//
// A handover that narrows to the next step loses work that is settled but not yet
// done. On 2026-11-10 a client stylesheet task passed through several handovers;
// the last one named one narrow item, and about ten rulings the user had already
// made, a half-built trimmed file and an unanswered comparison page all dropped out.
// The resumed session spent a morning removing 7 lines when ~140 were approved.
// The handover skill asks the saving session to carry these forward (#197), but a
// skill is a request, not a guarantee. This is the guarantee: at save time, every
// open item in the previous handover of the chain that the new one does not
// mention is appended to it verbatim, under its own heading, so the next session
// sees it whatever the saving session forgot.
//
// "Open item" = a line under "Decided, not yet applied", "Open questions",
// "Progress", "Read first", "Decisions already made", "Do not", or an earlier
// "Carried forward" section. "Mentioned" = most of the
// item's significant words appear somewhere in the new body, so an item the new
// handover restates, marks done or marks dropped in its own words stops carrying.

export const CARRIED_HEADING = "Carried forward from the previous handover";

const OPEN_SECTIONS = [
  { match: /^decided,? not yet applied/i, tag: "decided" },
  { match: /^open questions?/i, tag: "open question" },
  { match: /^progress/i, tag: "progress" },
  // Files kept across sessions (a decision log, a workspace map, a do-not list).
  // The ERF chain kept repeating mistakes those files already recorded, because a
  // later handover stopped naming them (2026-11-10).
  { match: /^read first/i, tag: "read first" },
  // Standing rules the previous handover restated. Seed 7 of cornerman-eval Test 1
  // (2026-11-17): the second handover restated 12 rules under "Decisions already made", the
  // third, written for a narrow reading task, held only the commit-message rules, and the
  // final session missed 21 of 24 facts. Seed 3 went from 5 of 11 restated to 0.
  { match: /^decisions already made/i, tag: "rule", rule: true },
  { match: /^do not\b/i, tag: "do not", rule: true },
  { match: /^carried forward/i, tag: "" },
];

const STOP = new Set(
  "this that with from have been were will what when where which into than then them they their there these those about after before still only also each every same other just like make made does done should would could item items line lines file files none open".split(" "),
);

/** Sections of a markdown body: `## Heading` -> its lines. */
export function sections(body) {
  const out = [];
  let cur = null;
  for (const line of String(body ?? "").replace(/\r\n/g, "\n").split("\n")) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) {
      cur = { heading: h[1], lines: [] };
      out.push(cur);
    } else if (/^#\s/.test(line)) {
      cur = null;
    } else if (cur) cur.lines.push(line);
  }
  return out;
}

// "None. (Standing rules are listed below ...)" is None too: seed 7 carried that line twice, and
// what it pointed to had already dropped out.
const isNone = (s) => /^(none|n\/a|nothing|-)\.?(\s*\([^)]*\)\.?)?$/i.test(s.trim());

/** The open items a handover holds: [{ tag, text }]. A "None" line is no item. */
export function openItems(body) {
  const items = [];
  for (const s of sections(body)) {
    const kind = OPEN_SECTIONS.find((k) => k.match.test(s.heading));
    if (!kind) continue;
    // One item per bullet; a continuation line joins the bullet above it, and a
    // section written as prose with no bullets is one item.
    let cur = null;
    const flush = () => {
      if (cur && cur.text.trim() && !isNone(cur.text)) items.push(cur);
      cur = null;
    };
    const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;
    for (const [n, raw] of s.lines.entries()) {
      const line = raw.trimEnd();
      if (!line.trim()) {
        if (kind.tag === "progress") continue;
        flush();
        continue;
      }
      const bullet = BULLET.exec(line);
      // A line that is only the carried section's own explanation is not an item.
      if (!bullet && kind.tag === "" && /^Open in the previous handover/i.test(line.trim())) continue;
      // A rules section's lead-in ("Standing rules and facts from the user:") is not a rule, but
      // only when bullets follow it: a one-line prose rule can end in a colon too.
      const next = s.lines.slice(n + 1).find((l) => l.trim());
      if (!bullet && !cur && kind.rule && /:\s*$/.test(line) && next && BULLET.test(next)) continue;
      if (bullet) {
        flush();
        cur = { tag: kind.tag, text: bullet[1].trim() };
      } else if (cur) cur.text += ` ${line.trim()}`;
      else cur = { tag: kind.tag, text: line.trim() };
    }
    flush();
  }
  // An earlier carried item keeps the tag it was carried with: "[decided] ...".
  for (const it of items) {
    const tagged = /^\[([a-z ]+)\]\s+(.*)$/i.exec(it.text);
    if (!it.tag && tagged) {
      it.tag = tagged[1].toLowerCase();
      it.text = tagged[2];
    }
    if (!it.tag) it.tag = "open";
  }
  return items;
}

export const words = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/`/g, "")
    .split(/[^a-z0-9_./#-]+/)
    .map((w) => w.replace(/^[./#-]+|[./#-]+$/g, ""))
    .filter((w) => (w.length >= 4 || /\d/.test(w)) && !STOP.has(w))
    // Light stemming, so "deleted" mentions "delete" and "rules" mentions "rule".
    .map((w) => (/\d|[./#]/.test(w) ? w : w.replace(/(ing|ed|es|s|e)$/, "")))
    // "dropped" -> "dropp" -> "drop": undouble a final consonant the suffix left behind.
    .map((w) => (/\d|[./#]/.test(w) ? w : w.replace(/([b-df-hj-np-tv-z])\1$/, "$1")));

// A bracket that says where something is recorded ("(ruled in decisions.md #4)", "(see PLAN.md)") is a
// pointer. Any other bracket is part of the item: "(250 means 2.5%, never 0.025 or 2.5)" is the rule
// itself, and stripping it left only words every ledger handover repeats (dev trial 4, fix 11).
const POINTER = /\.[a-z]{1,5}\b|\/|#\d|\b(?:ruled|recorded|logged|see|per)\b/i;
const withoutPointers = (text) => String(text).replace(/\([^)]*\)/g, (b) => (POINTER.test(b) ? " " : b));

/** Whether the new body still mentions an item: most of its significant words appear in it. */
export function mentioned(item, body) {
  const have = new Set(words(body));
  // A bracketed pointer ("(ruled in decisions.md #4)") says where, not what: a
  // restatement rarely repeats it, so it does not count against a match.
  const want = [...new Set(words(withoutPointers(item.text)))];
  if (!want.length) {
    const flat = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
    return flat(body).includes(flat(item.text));
  }
  const hit = want.filter((w) => have.has(w)).length;
  if (hit / want.length >= 0.6) return true;
  // The clause before the first comma or dash is the item; what follows is often its
  // reason ("Drop the gallery hover zoom, the built-in look is fine"), which a
  // restatement ("Gallery hover zoom dropped") does not repeat. A head of at least
  // three significant words, all present, counts as a mention.
  const head = [...new Set(words(withoutPointers(item.text).split(/,|\s[-:]\s|;/)[0]))];
  return head.length >= 3 && head.every((w) => have.has(w));
}

/** Remove a previous carried section from a body, so a save never stacks two. */
function withoutCarried(body) {
  const lines = String(body).replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let skip = false;
  for (const line of lines) {
    if (/^##\s+/.test(line)) skip = new RegExp(`^##\\s+${CARRIED_HEADING}`, "i").test(line);
    else if (/^#\s/.test(line)) skip = false;
    if (!skip) out.push(line);
  }
  return out.join("\n").trimEnd();
}

/**
 * The new body with every open item of `previous` that it does not mention
 * appended under the carried heading. Returns { body, carried }. Items are
 * matched against the new body without its own carried section, so an item the
 * session dropped by hand is caught, while one it rewrote in place is not
 * repeated. Never throws: a body it cannot read comes back unchanged.
 */
// `replaced`: rulings a later correction replaced (rulings.mjs replacedRulings). A rule item
// restating one is not carried: it would sit beside its correction as a live rule, the way seed 7
// kept "2 spaces" next to "Make that 3 spaces" (reviewer, 2026-11-18).
export function carryForward(body, previous, { replaced = [] } = {}) {
  try {
    if (!previous?.body) return { body, carried: [] };
    const own = withoutCarried(body);
    const seen = new Set();
    const carried = openItems(previous.body).filter((it) => {
      const k = `${it.tag}|${it.text.toLowerCase()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      if ((it.tag === "rule" || it.tag === "do not") && replaced.some((t) => mentioned(it, t))) return false;
      return !mentioned(it, own);
    });
    // A rule that waits on the user is a job's stop, not a standing rule: carried as a [stop], so the
    // "still holds" line below does not ask for it under Do not again (trial 3, fix 10).
    for (const it of carried) if ((it.tag === "rule" || it.tag === "do not") && isHold(it)) it.tag = "stop";
    if (!carried.length) return { body: own, carried };
    const from = previous.title ? ` "${previous.title}"` : "";
    const section =
      `## ${CARRIED_HEADING}\n` +
      `Open in the previous handover${from} and not mentioned in this one, so saving added them: nothing drops out ` +
      `silently. Treat each as still open. Apply it, or say in your next handover that it is done or dropped.` +
      (carried.some((it) => it.tag === "rule" || it.tag === "do not")
        ? ` A [rule] or [do not] still holds: restate it under "Decisions already made" or "Do not" next time.`
        : "") +
      (carried.some((it) => it.tag === "stop")
        ? ` A [stop] is where the user paused a job: put it under State, with what comes next, and keep only what the user said to leave alone for good under Do not.`
        : "") +
      `\n` +
      carried.map((it) => `- [${it.tag}] ${it.text}`).join("\n");
    return { body: `${own}\n\n${section}`, carried };
  } catch {
    return { body, carried: [] };
  }
}

/**
 * The handover this save continues: the newest of this window's own waiting ones
 * (the ones the save supersedes) and the ones this window loaded. Loaded ones
 * count only within `maxAgeDays`, so a chain resumed weeks later does not drag in
 * long-settled items. With no owner known nothing is picked: guessing could fold
 * another window's chain into this one.
 */
// The owner the headless runner (lib/run.mjs) stamps on a handover it loads into the
// next segment. Each segment is a new claude process with an owner of its own, so with
// `runner` set (a save in segment 2 or later) a load by the runner counts as this one's.
export const RUNNER_OWNER = "cornerman-run";

export function previousHandover({ own = [], loaded = [], owner, sameOwner, now = new Date(), maxAgeDays = 7, runner = false }) {
  if (!owner) return null;
  const cutoff = new Date(now).getTime() - maxAgeDays * 86_400_000;
  const mineLoaded = loaded.filter((h) => {
    const by = h.archivedBy?.owner;
    const at = Date.parse(h.archivedAt ?? "");
    const ours = by && (sameOwner(by, owner) || (runner && by === RUNNER_OWNER && h.archivedBy?.via === "load"));
    return ours && Number.isFinite(at) && at >= cutoff;
  });
  const when = (h) => Date.parse(h.archivedAt ?? "") || Date.parse(h.meta?.created ?? "") || 0;
  return [...own, ...mineLoaded].sort((a, b) => when(b) - when(a))[0] ?? null;
}

/** How many open items a handover holds, for the load-time listing of other handovers. */
export function openCount(body) {
  return openItems(body).filter((it) => it.tag === "decided" || it.tag === "open question").length;
}

// A line that holds work until the user speaks again. Development trial 3 of the cornerman-eval stress
// test (seed 102, 2026-11-20): one handover filed the user's "don't go on to step 4" under Do not as
// "do not write step 4 ... until told to carry on", and every later writer restated it (12 of 17); an
// unanswered "what does 'that' mean?" became "Do not change any indentation rule until answered" under
// Open questions, and the next session kept the old 2-space rule. "Unless asked" is a standing rule
// ("do not commit unless asked") and is not matched. Nor is a condition the user named: "no edits until
// the user says it is signed off" and "until told otherwise" are the user's own rules (every handover
// of the same trial held the first), so only a wait for an answer or for "carry on" counts.
const HOLD = /\b(?:until|till)\s+(?:(?:it\s+is|it's|this\s+is|they\s+are)\s+)?(?:answered|clarified|(?:the\s+)?user\s+(?:answers|replies|clarifies)|told\s+to\s+(?:carry\s+on|continue|go\s+on|proceed|resume))\b/i;
const HOLD_SECTIONS = { "do not": "Do not", "open question": "Open questions", rule: "Decisions already made" };
const isHold = (it) => it.tag in HOLD_SECTIONS && HOLD.test(it.text) && (it.tag !== "open question" || /\b(?:do not|don'?t|never)\b/i.test(it.text));

/** The session's own Do not, Open questions and Decisions lines that wait on the user: [{ section, text }]. */
export function waitingHolds(body) {
  return openItems(withoutCarried(body))
    .filter(isHold)
    .map((it) => ({ section: HOLD_SECTIONS[it.tag], text: it.text }));
}

// A Read first file the work keeps writing to. Development trial 5 of the cornerman-eval stress test
// (seed 104, 2026-11-26): every handover listed docs/reading-notes.md, which the work appended a line to
// per reading file, and each doc the session wrote joined the list (8 files by the end). The start note
// opens every Read first file, so each session re-read more and the start context climbed from 22k to
// 58k. A file changed since the previous handover was saved is named at save time: a record (a decision
// log) may stay, work output goes under Key files.
const PATH_AT_START = /^`?([^\s`]+?)`?(?:\s+[-:(]|\s*$)/;

/** The session's own Read first paths whose file changed after `previous.created`, relative to `top`. */
export function growingReads(body, previous, top) {
  const since = Date.parse(previous?.created ?? "");
  if (!Number.isFinite(since)) return [];
  const out = [];
  for (const it of openItems(withoutCarried(body))) {
    if (it.tag !== "read first") continue;
    const m = PATH_AT_START.exec(it.text.trim());
    if (!m) continue;
    try {
      if (statSync(isAbsolute(m[1]) ? m[1] : join(top, m[1])).mtimeMs > since) out.push(m[1]);
    } catch {
      // gone or not a path: nothing to name
    }
  }
  return out;
}

/** Whether a body states both always-present sections, even as "None". */
export function missingSections(body) {
  const heads = sections(body).map((s) => s.heading);
  const need = [
    ["Read first", /^read first/i],
    ["Decided, not yet applied", /^decided,? not yet applied/i],
    ["Open questions", /^open questions?/i],
  ];
  return need.filter(([, re]) => !heads.some((h) => re.test(h))).map(([name]) => name);
}
