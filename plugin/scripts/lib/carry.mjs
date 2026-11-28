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

/** Whether the new body still mentions an item: most of its significant words appear in it. */
export function mentioned(item, body) {
  const have = new Set(words(body));
  // A bracketed pointer ("(ruled in decisions.md #4)") says where, not what: a
  // restatement rarely repeats it, so it does not count against a match.
  const want = [...new Set(words(String(item.text).replace(/\([^)]*\)/g, " ")))];
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
  const head = [...new Set(words(String(item.text).replace(/\([^)]*\)/g, " ").split(/,|\s[-:]\s|;/)[0]))];
  return head.length >= 3 && head.every((w) => have.has(w));
}

// Closed by file. The field audit of 2026-11-28 found about 1 in 5 handovers carrying forward
// work the same handover closed: "DONE: stress/PREDICTIONS-DEV-TRIAL-6.md written, committed,
// pushed" names the item's file in far fewer words than the item, so the word match above misses
// it, and the next session is told to treat finished work as open. An item whose head names a
// file is closed when a closing line names the same file. Hand-checked on 14 real hits, 12 were
// closings; the other 2 pointed at a file the new handover still names. A looser test (3 shared
// words with any done-ish line) was right about 4 times in 10, so it is not used: a wrong match
// drops live work silently. Standing rules are never closed this way: a rule is not finished.
const CLOSE_WORD = /\b(?:done|dropped|closed|merged|shipped|resolved|finished|completed|superseded|retired|cancelled|moot|no longer (?:needed|open))\b/i;
// A goal ("Done = every test passes") or a step still to come ("once #22 is merged") closes nothing.
// "(?:[^.]|\.\S)*": a file name's dot ("oven-log.mjs") does not end the clause, a full stop does.
const NOT_CLOSE =
  /\b(?:done|finished|completed?)\s*(?:=|when|means|if)\b|\bwhen (?:\w+ ){0,3}(?:finished|done)\b|\b(?:once|until|after|before|if)\b(?:[^.]|\.\S)*\b(?:done|merged|finished|shipped)\b/i;
const FILE = /[\w./~:\\-]*[\w-]+\.(?:mjs|cjs|mts|js|jsx|ts|tsx|md|json|jsonl|sh|ps1|py|css|scss|html|astro|svelte|vue|sql|toml|txt|yml|yaml)\b/gi;
const normPath = (p) => p.toLowerCase().replace(/\\/g, "/").replace(/^[a-z]:\//, "/").replace(/^~\//, "/");
const filesIn = (s) => (String(s).match(FILE) || []).map(normPath);
// The same file: equal, or one path ends the other at a folder boundary. A bare name never
// matches a longer path: PROJECT-PLAN.md is a different file in every folder.
const sameFile = (a, b) => {
  if (a === b) return true;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  return short.includes("/") && long.endsWith(`/${short.replace(/^\//, "")}`);
};
const NOT_CLOSING_SECTION = /^(?:goal|rulings from the user|recent trail)/i;
/** The sentences of a body that close something: all of a "Done or dropped" section, and done-marked ones elsewhere. */
function closingLines(body) {
  return sections(body)
    .filter((s) => !NOT_CLOSING_SECTION.test(s.heading))
    .flatMap((s) => {
      const all = /^done or dropped/i.test(s.heading);
      return s.lines.flatMap((l) => l.split(/;|\.\s/)).filter((l) => (all || CLOSE_WORD.test(l)) && !NOT_CLOSE.test(l));
    });
}
const itemHead = (text) => String(text).replace(/\([^)]*\)/g, " ").split(/,|\s[-:]\s|;/)[0];
/** Whether a closing line in `body` names the file the item's head names. */
export function closedByFile(item, body) {
  if (item.tag === "rule" || item.tag === "do not") return false;
  const want = filesIn(itemHead(item.text));
  if (!want.length) return false;
  return closingLines(body).some((l) => filesIn(l).some((f) => want.some((w) => sameFile(f, w))));
}

// Not done: dropping a read-first item because the new handover names its file again. Replayed on
// 14 days of real handovers (2026-11-28) it dropped 104 carried items, and its gloss was often work
// the bare pointer does not hold ("lines 286-287, 368 are the ones to edit", "written, not wired
// into any game"). A repeated pointer costs a line; a lost instruction costs the work.

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
      return !mentioned(it, own) && !closedByFile(it, own);
    });
    if (!carried.length) return { body: own, carried };
    const from = previous.title ? ` "${previous.title}"` : "";
    const section =
      `## ${CARRIED_HEADING}\n` +
      `Open in the previous handover${from} and not mentioned in this one, so saving added them: nothing drops out ` +
      `silently. Treat each as still open. Apply it, or say in your next handover that it is done or dropped.` +
      (carried.some((it) => it.tag === "rule" || it.tag === "do not")
        ? ` A [rule] or [do not] still holds: restate it under "Decisions already made" or "Do not" next time.`
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
