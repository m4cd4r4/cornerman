// The session-start context, held under Claude Code's cap on one hook output.
//
// Claude Code replaces a SessionStart hook output over 10,000 characters with a 2KB preview and
// a file path ("Output too large"). cornerman sent the handover and its rulings log as one output
// of 10-14KB with the standing rules at the end, so the rules were the part cut: 21 of 24 loads in
// cornerman-eval Test 1 and 23 of 24 in stage A (fault 6). Seed 7 never opened the file and scored
// 3 of 24. The cap was measured exactly (rig/spike/captest.mjs, CLI 2.1.316): 10,000 characters
// arrive whole, 10,001 are cut, and it is per hook output, not in total.
//
// So a context over BUDGET goes out in two outputs: the main SessionStart hook sends the handover's
// state, and a second hook command (session-start-part.mjs) sends its standing rules. The main hook
// decides everything and leaves the second part in a spool file; the second hook only waits for
// it and prints it, so a handover is never chosen twice. Inside each part, what shrinks first when
// it alone is over the budget is set by each block's rank, and anything left out is named, with
// where the full copy is.
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PART_REPLACED, REPLACED, RULINGS_HEADING } from "./rulings.mjs";
import { CARRIED_HEADING } from "./carry.mjs";

/** Claude Code's cap on one hook output, in characters (UTF-16 units, as JS counts them). */
export const CAP = 10_000;
/** What cornerman lets one output carry: a 1,000-character (10%) margin under CAP. */
export const BUDGET = 9_000;
// How parts of the context are joined, in hook.mjs too.
export const SEP = "\n\n---\n\n";

export const RULES_HEAD = "cornerman: standing rules for handover";
const RULE_SECTION = [/^decisions already made/i, /^do not\b/i, new RegExp(`^${RULINGS_HEADING}\\s*$`, "i")];
const CARRIED = new RegExp(`^${CARRIED_HEADING}`, "i");
const CARRIED_RULE = /^\s*[-*+]\s+\[(rule|do not)\]\s/i;
const BULLET = /^\s*(?:[-*+]|\d+[.)])\s/;
const LAST = [/^next action/i, /^goal/i];
const OPEN = [/^read first/i, /^decided,? not yet applied/i, /^open questions?/i, CARRIED];

// Ranks: lower goes first, NEVER stays. Within a rank `order` decides, lower first.
const NEVER = Infinity;
const R = {
  listed: { rank: 1, what: ["other waiting handover listed", "other waiting handovers listed"] },
  request: { rank: 1, what: ["task request", "task requests"] },
  replaced: { rank: 2, what: ["replaced ruling", "replaced rulings"] },
  detail: { rank: 2, what: ["line of handover detail", "lines of handover detail"] },
  rule: { rank: 3, what: ["standing rule", "standing rules"] },
  open: { rank: 3, what: ["line of open work", "lines of open work"] },
  next: { rank: 4, what: ["line of the goal or next action", "lines of the goal or next action"] },
};
const keep = (text) => ({ text, rank: NEVER });

/** Markdown lines -> [{ heading, lines }], the lines before any `## ` heading under heading null. */
function sections(text) {
  const out = [{ heading: null, lines: [] }];
  for (const line of String(text).replace(/\r\n/g, "\n").split("\n")) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) out.push({ heading: h[1], lines: [] });
    else out.at(-1).lines.push(line);
  }
  return out;
}

/** Bullet items with their continuation lines joined, other lines one each. */
function items(lines) {
  const out = [];
  for (const line of lines) {
    if (out.length && line.trim() && !BULLET.test(line) && /^\s+\S/.test(line) && BULLET.test(out.at(-1))) out[out.length - 1] += `\n${line}`;
    else out.push(line);
  }
  return out;
}

/** A handover body split into its state and its standing-rule sections: { state, rules: [{ heading, lines }] }. */
export function splitBody(body) {
  const state = [];
  const rules = [];
  for (const s of sections(body)) {
    if (s.heading && RULE_SECTION.some((re) => re.test(s.heading))) {
      rules.push(s);
      continue;
    }
    if (s.heading && CARRIED.test(s.heading)) {
      const all = items(s.lines);
      const carried = all.filter((l) => CARRIED_RULE.test(l));
      if (carried.length) rules.unshift({ heading: `${s.heading} (rules)`, lines: carried });
      s.lines = all.filter((l) => !CARRIED_RULE.test(l));
    }
    state.push(s.heading ? [`## ${s.heading}`, ...s.lines].join("\n") : s.lines.join("\n"));
  }
  return { state: state.join("\n").trim(), rules };
}

const plural = (n, [one, many]) => `${n} ${n === 1 ? one : many}`;

function leftOut(dropped, copyPath) {
  if (!dropped.length) return "";
  const counts = new Map();
  for (const b of dropped) counts.set(b.what, (counts.get(b.what) ?? 0) + 1);
  const what = [...counts].map(([w, n]) => plural(n, w)).join(", ");
  return (
    `cornerman: left out of this block to stay under Claude Code's ${CAP.toLocaleString("en")}-character limit on one hook output: ${what}. ` +
    (copyPath
      ? `The full handover is in ${copyPath}: open it and read what was left out before your first action.`
      : `The full handover could not be saved to a file: ask the user before acting on anything not listed here.`)
  );
}

/**
 * Blocks joined by newlines, at or under `budget`: the lowest-ranked go first (by `order` within a
 * rank), and a notice names them. A NEVER block is never dropped; if those alone are over, the text
 * is cut at the budget with the same notice, so no output passes the budget whatever it holds.
 */
export function fit(blocks, budget, copyPath) {
  const kept = blocks.map((b, i) => ({ order: i, ...b }));
  const dropped = [];
  const render = () => [...kept.map((b) => b.text), leftOut(dropped, copyPath)].filter((t, i, a) => i < a.length - 1 || t).join("\n");
  let text = render();
  while (text.length > budget) {
    let at = -1;
    kept.forEach((b, i) => {
      if (b.rank === NEVER) return;
      const best = kept[at];
      if (at < 0 || b.rank < best.rank || (b.rank === best.rank && b.order < best.order)) at = i;
    });
    if (at < 0) break;
    dropped.push(...kept.splice(at, 1));
    text = render();
  }
  if (text.length <= budget) return text;
  const tail = `\n[cut here] ${leftOut([{ what: ["part of this block", "parts of this block"] }], copyPath)}`;
  return text.slice(0, Math.max(0, budget - tail.length)) + tail;
}

// A part that is not the handover: its first line stays; a list's entries (each with the command
// under it) may go, the count in its first line still saying how many there are.
function noteBlocks(text) {
  const [first, ...rest] = items(String(text).split("\n"));
  return [keep(first), ...rest.map((t) => (/^\s*- /.test(t) ? { text: t, ...R.listed } : keep(t)))];
}

function stateBlocks(state) {
  const out = [];
  const secs = sections(state);
  const total = secs.reduce((n, s) => n + s.lines.length, 0);
  let seen = 0;
  for (const s of secs) {
    if (s.heading) out.push(keep(`## ${s.heading}`));
    const kind = !s.heading ? null : LAST.some((re) => re.test(s.heading)) ? R.next : OPEN.some((re) => re.test(s.heading)) ? R.open : R.detail;
    for (const line of items(s.lines)) {
      seen++;
      // Detail goes from the end of the handover back: its opening says most.
      out.push(!line.trim() || !kind ? keep(line) : { text: line, ...kind, order: total - seen });
    }
  }
  return out;
}

function ruleBlocks(title, rules) {
  const out = [keep(`${RULES_HEAD} "${title}". This is part 2 of its context; part 1 has the goal, state and next action. Each rule holds for all work in this session unless a later one replaces it.`)];
  for (const s of rules) {
    out.push(keep(""), keep(`## ${s.heading}`));
    let kind = R.rule;
    const lines = [...s.lines];
    while (lines.length && !lines.at(-1).trim()) lines.pop();
    for (const line of items(lines)) {
      if (/^Task requests/i.test(line)) kind = R.request;
      else if (/^Standing rules/i.test(line)) kind = R.rule;
      if (!BULLET.test(line)) {
        out.push(keep(line));
        continue;
      }
      const replaced = kind === R.rule && line.trimEnd().endsWith(REPLACED) && !line.trimEnd().endsWith(PART_REPLACED);
      out.push({ text: line, ...(replaced ? R.replaced : kind) });
    }
  }
  return out;
}

/**
 * The session-start context as { main, extra }: `main` for the SessionStart hook's own output and
 * `extra` ("" when none) for the second hook, each at or under `budget`.
 * `parts`: the context's parts in order; `handover`: { at, preamble, body, title, copyPath } when a
 * handover was loaded, `at` being its index in `parts`.
 */
export function packStart({ parts, handover }, { budget = BUDGET } = {}) {
  const whole = parts.join(SEP);
  if (whole.length <= budget) return { main: whole, extra: "" };
  const split = handover ? splitBody(handover.body) : null;
  const sepBlocks = [keep(""), keep("---"), keep("")];
  const main = [];
  parts.forEach((p, i) => {
    if (i) main.push(...sepBlocks);
    if (!handover || i !== handover.at) return main.push(...noteBlocks(p));
    main.push(keep(handover.preamble));
    if (split.rules.length)
      main.push(
        keep(""),
        keep(
          `cornerman: this handover's standing rules (${split.rules.map((s) => `"${s.heading}"`).join(", ")}) arrive in a separate cornerman block headed "${RULES_HEAD}". ` +
            `If that block is not in your context, ${handover.copyPath ? `open ${handover.copyPath} and read those sections` : "ask the user for them"} before your first action.`,
        ),
      );
    main.push(keep(""), ...stateBlocks(split.rules.length ? split.state : handover.body));
  });
  const copyPath = handover?.copyPath;
  return {
    main: fit(main, budget, copyPath),
    extra: split?.rules.length ? fit(ruleBlocks(handover.title, split.rules), budget, copyPath) : "",
  };
}

// The spool the main hook leaves for the second one: <store>/.start-parts/<session>-<source>.json,
// { at, text }. Keyed by source too, because one /clear in the VS Code extension fires
// SessionStart twice (startup and clear), each with its own pair of hooks.
const SPOOL = ".start-parts";
const safe = (s) => String(s ?? "").replace(/[^A-Za-z0-9_-]/g, "");
const spoolFile = (root, input) => join(root, SPOOL, `${safe(input?.session_id)}-${safe(input?.source || "startup")}.json`);
const STALE_MS = 3_600_000;

/** Leave `text` ("" for nothing) for the second hook. Written on every path, so it never waits long. Never throws. */
export function writeSpool(root, input, text, now = Date.now()) {
  try {
    const dir = join(root, SPOOL);
    mkdirSync(dir, { recursive: true });
    const file = spoolFile(root, input);
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ at: now, text: String(text ?? "") }), "utf8");
    renameSync(tmp, file);
    for (const name of readdirSync(dir)) {
      try {
        if (now - statSync(join(dir, name)).mtimeMs > STALE_MS) rmSync(join(dir, name), { force: true });
      } catch {}
    }
  } catch {}
}

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * The text the main hook left for this session start, waiting up to `waitMs` for it. Only a spool
 * written at or after `since` counts: an older one belongs to an earlier start. "" when none came.
 */
export function takeSpool(root, input, { since, waitMs = 15_000, stepMs = 50 } = {}) {
  const file = spoolFile(root, input);
  const until = Date.now() + waitMs;
  for (;;) {
    try {
      const row = JSON.parse(readFileSync(file, "utf8"));
      if (Number(row?.at) >= since) {
        rmSync(file, { force: true });
        return typeof row.text === "string" ? row.text : "";
      }
    } catch {
      // not there yet, or half written
    }
    if (Date.now() >= until) return "";
    pause(stepMs);
  }
}
