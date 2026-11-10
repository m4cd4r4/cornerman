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
// "Progress", or an earlier "Carried forward" section. "Mentioned" = most of the
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

const isNone = (s) => /^(none|n\/a|nothing|-)\.?$/i.test(s.trim());

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
    for (const raw of s.lines) {
      const line = raw.trimEnd();
      if (!line.trim()) {
        if (kind.tag === "progress") continue;
        flush();
        continue;
      }
      const bullet = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
      // A line that is only the carried section's own explanation is not an item.
      if (!bullet && kind.tag === "" && /^Open in the previous handover/i.test(line.trim())) continue;
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

const words = (s) =>
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
export function carryForward(body, previous) {
  try {
    if (!previous?.body) return { body, carried: [] };
    const own = withoutCarried(body);
    const seen = new Set();
    const carried = openItems(previous.body).filter((it) => {
      const k = `${it.tag}|${it.text.toLowerCase()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return !mentioned(it, own);
    });
    if (!carried.length) return { body: own, carried };
    const from = previous.title ? ` "${previous.title}"` : "";
    const section =
      `## ${CARRIED_HEADING}\n` +
      `Open in the previous handover${from} and not mentioned in this one, so saving added them: nothing drops out ` +
      `silently. Treat each as still open. Apply it, or say in your next handover that it is done or dropped.\n` +
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
export function previousHandover({ own = [], loaded = [], owner, sameOwner, now = new Date(), maxAgeDays = 7 }) {
  if (!owner) return null;
  const cutoff = new Date(now).getTime() - maxAgeDays * 86_400_000;
  const mineLoaded = loaded.filter((h) => {
    const by = h.archivedBy?.owner;
    const at = Date.parse(h.archivedAt ?? "");
    return by && sameOwner(by, owner) && Number.isFinite(at) && at >= cutoff;
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
