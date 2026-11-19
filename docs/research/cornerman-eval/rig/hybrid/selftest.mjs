#!/usr/bin/env node
// Selftest of the hybrid hooks: each hook is run as Claude Code runs it (a process, JSON on stdin)
// against a throwaway store, in the order the CLI runs them at a compaction: pre, start, post, then
// deliver at the next tool call. No model, no CLI. Every check has a case that must pass and one
// that must fail, so a check that cannot see a failure shows up here.
//   node selftest.mjs <cornerman plugin/scripts/lib>
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CM_LIB = process.argv[2];
if (!CM_LIB || !existsSync(join(CM_LIB, "rulings.mjs"))) { console.error("usage: node selftest.mjs <cornerman plugin/scripts/lib>"); process.exit(2); }
const STORE = mkdtempSync(join(tmpdir(), "hybrid-selftest-"));
const run = (hook, input) => {
  const r = spawnSync(process.execPath, [join(HERE, `${hook}.mjs`)], { input: JSON.stringify(input), encoding: "utf8", env: { ...process.env, CM_LIB, HYBRID_STORE: STORE } });
  if (r.status !== 0) throw new Error(`${hook} exit ${r.status}: ${r.stderr}`);
  return r.stdout;
};
const rows = (name) => { try { return readFileSync(join(STORE, "trace", `${name}.jsonl`), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const context = (out, event) => {
  if (!out) return "";
  const h = JSON.parse(out).hookSpecificOutput;
  if (event && h.hookEventName !== event) throw new Error(`expected ${event}, got ${h.hookEventName}`);
  return h.additionalContext;
};
let failed = 0;
const check = (name, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok || !detail ? "" : `\n     ${String(detail).slice(0, 600)}`}`); };
const say = (s, prompt) => run("prompt", { session_id: s, prompt });
const compact = (s, summary) => { const c = context(run("start", { session_id: s, source: "compact" }), "SessionStart"); run("post", { session_id: s, trigger: "auto", compact_summary: summary }); return c; };
const tool = (s) => context(run("deliver", { session_id: s, hook_event_name: "PostToolUse" }), "PostToolUse");

// --- Session A.
const A = "sess-a";
say(A, "New code uses 2 spaces per indent.");
say(A, "Never use floats for money, integer cents only.");
say(A, "/compact");
say(A, "ok");
say(A, "Actually make that 3 spaces.");
say(A, "Add applyFee to src/money.js");
const log = readFileSync(join(STORE, "rulings", `${A}.jsonl`), "utf8").split("\n").filter(Boolean);
check("prompt: 4 of 6 prompts logged (a slash command and a bare ok are not the user's rulings)", log.length === 4, log.join(" | "));

const pre = run("pre", { session_id: A, trigger: "auto" });
check("pre: instructions name the section and all six tags", /## Carried forward/.test(pre) && ["rule", "choice", "fact", "decision", "in flight", "ask first"].every((t) => pre.includes(`[${t}]`)));

const S1 = `<summary>
1. Primary Request: ledger work. The user wants new code to use 3 spaces per indent.

## Carried forward
- [rule] New code uses 3 spaces per indent (replaced 2 spaces).
- [fact] The staging port is 4417, printed by scripts/print-port.mjs (since deleted).
- [choice] Storage: SQLite with one table per account, the second option offered.
- [in flight] Release script: steps 1-3 of 5 done, step 4 in progress, nothing committed.
- [decision] Rounding is done once at output, because rounding per line item drifted by a cent in the test.
</summary>`;
let c = compact(A, S1);
let p = rows("postcompact").at(-1);
check("start 1: the rule a summary may drop arrives word for word", c.includes('"Never use floats for money, integer cents only."'), c);
check("start 1: the replaced rule is marked", /"New code uses 2 spaces per indent\." \(replaced by a later one\)/.test(c), c);
check("start 1: no carried list before any summary has dropped anything", !/Carried from earlier summaries/.test(c), c);
check("post 1: five tagged items filed", p.items === 5 && p.hasSection, JSON.stringify(p));
check("post 1: the rule the summary kept is not reported missing (passing case)", !p.rulesMissing.some((t) => /3 spaces/.test(t)), JSON.stringify(p.rulesMissing));
check("post 1: the rule the summary dropped is reported missing (failing case)", p.rulesMissing.some((t) => /integer cents/.test(t)), JSON.stringify(p.rulesMissing));
check("post 1: the replaced rule is not counted as a rule to keep", p.rules === 2 && !p.rulesMissing.some((t) => /2 spaces/.test(t)), JSON.stringify(p));
check("post 1: summary saved", existsSync(join(STORE, "summaries", `${A}-1.md`)));
check("deliver: nothing to hand over while the summary holds every item", tool(A) === "" && rows("deliver").length === 0);
check("start: silent on source startup", run("start", { session_id: A, source: "startup" }) === "" && rows("sessionstart").length === 1);

// The second summary drops the port and the choice, rewords the decision, and has no section.
const S2 = `<summary>
1. Primary Request: ledger work, 3 spaces per indent.
2. Notes: rounding happens once at output since per line item rounding drifted a cent. A port 5521 was mentioned for staging.
</summary>`;
c = compact(A, S2);
p = rows("postcompact").at(-1);
check("start 2: runs before post, so it cannot yet list what summary 2 dropped", !/4417/.test(c), c);
check("post 2: a summary with no section files no items (failing case of post 1)", p.items === 0 && p.hasSection === false, JSON.stringify(p));
check("post 2: the fact with a changed value counts as dropped", p.earlierItemsDropped.some((t) => /4417/.test(t)), JSON.stringify(p.earlierItemsDropped));
check("post 2: the reworded decision counts as held", !p.earlierItemsDropped.some((t) => /Rounding/.test(t)), JSON.stringify(p.earlierItemsDropped));
c = tool(A);
check("deliver: the next tool call hands over the dropped fact and choice", /\[fact\] The staging port is 4417/.test(c) && /\[choice\] Storage: SQLite/.test(c), c);
check("deliver: the held decision, the in-flight state and the rule wording are not handed over", !/\[decision\]/.test(c) && !/\[in flight\]/.test(c) && !/\[rule\]/.test(c), c);
check("deliver: once only", tool(A) === "" && rows("deliver").length === 1);

c = compact(A, S2);
check("start 3: items missing since summary 2 are in the start context from now on", /\[fact\] The staging port is 4417/.test(c) && /\[choice\] Storage: SQLite/.test(c) && !/\[decision\]/.test(c) && !/\[in flight\]/.test(c), c);
check("post 3: nothing newly dropped, so nothing pending", rows("postcompact").at(-1).pending === 0 && tool(A) === "");
c = compact(A, S1);
check("start 4 and post 4: an item a later summary holds again leaves the start context", /4417/.test(c) && !/Carried from earlier summaries/.test(compact(A, S1)), c);

// --- Session B: a prompt comes before any tool call.
const B = "sess-b";
say(B, "Always run the linter before a commit.");
compact(B, S1);
compact(B, S2);
c = context(say(B, "What port does staging use, do you know?"), "UserPromptSubmit");
check("prompt: hands over the dropped items when it comes before a tool call, and the tool call then has nothing", /4417/.test(c) && tool(B) === "", c);

// --- Session D: each summary rewords what it copies.
const D = "sess-d";
compact(D, S1);
compact(D, S1.replace("The staging port is 4417, printed by scripts/print-port.mjs (since deleted).", "Staging port: 4417. It was printed by scripts/print-port.mjs, which has since been deleted."));
const stateD = JSON.parse(readFileSync(join(STORE, "state", `${D}.json`), "utf8"));
check("post: a reworded copy of an item replaces it (5 items, not 6), newest wording kept", stateD.items.length === 5 && stateD.items.some((it) => it.text.startsWith("Staging port: 4417.")), stateD.items.map((it) => it.text).join(" | "));

// --- Session C: volume (class I). Rules over cornerman's bound, and more dropped items than fit.
const C = "sess-c";
for (let i = 1; i <= 70; i++) say(C, `Rule ${i}: never change module-${i}.js without running check-${i}, and always record result code ${1000 + i} in the audit file for area ${i}.`);
const many = Array.from({ length: 120 }, (_, i) => `- [fact] Service ${i} listens on port ${5000 + i}, read from the output of scripts/ports-${i}.mjs before it was removed.`).join("\n");
compact(C, `<summary>\n## Carried forward\n${many}\n</summary>`);
compact(C, "<summary>Nothing of note.</summary>");
c = tool(C);
check("volume: the handover of 120 dropped items is at or under 9,000 characters, the rest counted with their file", c.length <= 9000 && c.length > 8000 && /\d+ more left out for space; all are in /.test(c), `${c.length}`);
c = compact(C, "<summary>Nothing of note.</summary>");
const s = rows("sessionstart").at(-1);
check("volume: start output at or under 9,000 characters, not sliced", c.length <= 9000 && s.over === false, `${c.length} ${JSON.stringify(s)}`);
check("volume: dropped standing rules are counted, named, and the full log is pointed to", s.droppedRules > 0 && /standing rules are not in the list above/.test(c) && c.includes(join(STORE, "prompts", `${C}.jsonl`)) && /"Rule 1: never change module-1\.js/.test(c), c.slice(-1500));
const full = readFileSync(join(STORE, "prompts", `${C}.jsonl`), "utf8").split("\n").filter(Boolean).length;
check("volume: the uncut log has all 70 rules", full === 70, full);
check("volume: carried items that do not fit in the start context are counted with their file", /\d+ more left out for space; all are in /.test(c) && s.carriedAdded < s.carriedWanted, JSON.stringify(s));
check("control: the small first load of session A was far under the budget", rows("sessionstart")[0].chars < 2000, rows("sessionstart")[0].chars);

check("no hook logged an error", rows("error").length === 0, JSON.stringify(rows("error")));
console.log(failed ? `\n${failed} FAILED (store kept at ${STORE})` : "\nall passed");
process.exit(failed ? 1 : 0);
