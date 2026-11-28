// The rulings log: what the user said in chat reaches the handover in their own words.
// A headless clear in the quality-1m fill dial (2026-11-15) saved a handover holding
// none of the rules the user gave only in chat; nothing recorded what the user said.
// The UserPromptSubmit hook now records each prompt per session, and save.mjs adds a
// section from that log and from the previous handover's, so the whole chain keeps them.
// Fixture rulings are neutral and new (a bakery order app), never the quality-1m plants.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, statSync, utimesSync } from "node:fs";
import { prune } from "../plugin/packages/store/store.mjs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { archive, listWaiting } from "../plugin/scripts/lib/store.mjs";
import { addRulings, ENTRY_MAX, LOG_MAX, logPath, MAX_CHARS, MAX_ENTRIES, readLog, record } from "../plugin/scripts/lib/rulings.mjs";
import { GIT_TEST_TIMEOUT, removeTemp } from "./helpers/git-temp.mjs";

const SCRIPTS = fileURLToPath(new URL("../plugin/scripts/", import.meta.url));

let base, root, repo;
beforeEach(() => {
  base = realpathSync.native(mkdtempSync(join(tmpdir(), "cr-rulings-")));
  root = join(base, "store");
  repo = join(base, "work", "bakery-orders");
  mkdirSync(repo, { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: repo });
  execFileSync("git", ["-c", "user.email=t@x.invalid", "-c", "user.name=t", "commit", "--allow-empty", "-q", "-m", "init"], { cwd: repo });
});
afterEach(() => removeTemp(base));

const env = (session, extra = {}) => ({
  ...process.env,
  CORNERMAN_HOME: root,
  CORNERMAN_SYNC: "off",
  CORNERMAN_AUTO: "",
  CORNERMAN_HEADLESS: "",
  CORNERMAN_WEB: "",
  CLAUDE_CODE_SESSION_ID: session,
  CLAUDE_PID: "",
  ...extra,
});
const prompt = (session, text) =>
  execFileSync(process.execPath, [join(SCRIPTS, "prompt-submit.mjs")], { cwd: repo, input: JSON.stringify({ session_id: session, cwd: repo, prompt: text }), env: env(session), encoding: "utf8" });
const save = (session, title, body, extra) =>
  execFileSync(process.execPath, [join(SCRIPTS, "save.mjs"), "--title", title, "--cwd", repo], { cwd: repo, input: body, env: env(session, extra), encoding: "utf8" });
const saved = (title) => listWaiting(root, repo).find((h) => h.meta.title === title).body;

const BODY = "# Orders\n\n## Goal\nShip the order form.\n\n## Next action\nRun the tests.\n";

describe("the rulings log", () => {
  it("records each session's own words, and a save carries only its own session's", () => {
    prompt("sess-a", "Prices are always shown in whole cents, never rounded to the dollar.");
    prompt("sess-b", "Never email the customer before the baker confirms the order.");
    prompt("sess-c", "Use the word 'loaf' in the UI, not 'item'.");
    expect(prompt("sess-b", "Keep the pickup window at 30 minutes.")).toBe("");

    save("sess-b", "Orders B", BODY);

    const body = saved("Orders B");
    expect(body).toContain('"Never email the customer before the baker confirms the order."');
    expect(body).toContain('"Keep the pickup window at 30 minutes."');
    expect(body).not.toContain("whole cents");
    expect(body).not.toContain("loaf");
  }, GIT_TEST_TIMEOUT);

  it("carries the rulings down the chain: the second and third clear still list them", () => {
    const window = { CLAUDE_PID: "999991" }; // one window, its sessions cleared in turn (a dead pid is used bare)
    prompt("seg-1", "Never email the customer before the baker confirms the order.");
    save("seg-1", "Orders 1", BODY, window);
    for (const n of [2, 3]) {
      // The SessionStart hook loads the waiting handover into the cleared session.
      archive(root, null, listWaiting(root, repo).find((h) => h.meta.title === `Orders ${n - 1}`).path, { via: "hook", owner: "999991" });
      prompt(`seg-${n}`, "Continue from the cornerman handover that was just loaded.");
      save(`seg-${n}`, `Orders ${n}`, BODY, window);
      expect(saved(`Orders ${n}`)).toContain('"Never email the customer before the baker confirms the order."');
    }
    expect(saved("Orders 3").match(/Never email/g)).toHaveLength(1);
  }, GIT_TEST_TIMEOUT);

  // Reviewer, 2026-11-18: a rule the user later corrected was carried forward as a live [rule].
  it("does not carry forward a rule the user has since replaced", () => {
    const window = { CLAUDE_PID: "999992" };
    prompt("seg-1", "Indent with 2 spaces in every file.");
    save("seg-1", "Orders 1", `${BODY}\n## Decisions already made\n- Indent with 2 spaces in every file.\n- Never email the customer before the baker confirms.\n`, window);
    archive(root, null, listWaiting(root, repo).find((h) => h.meta.title === "Orders 1").path, { via: "hook", owner: "999992" });
    prompt("seg-2", "Make that 3 spaces.");
    save("seg-2", "Orders 2", BODY, window);
    const body = saved("Orders 2");
    expect(body).toContain("[rule] Never email the customer");
    expect(body).not.toContain("[rule] Indent with 2 spaces");
  }, GIT_TEST_TIMEOUT);

  it("carries them down a headless runner chain, where the runner loads each handover itself", () => {
    const seg = (n) => ({ CORNERMAN_AUTO: "1", CORNERMAN_HEADLESS: "1", CORNERMAN_CHAIN: String(n), CORNERMAN_BUDGET: "5", CLAUDE_PID: String(999980 + n) });
    prompt("run-1", "Build the order form. Never store card numbers.");
    prompt("run-1", "Keep the pickup window at 30 minutes."); // a later message in segment 1 (stream-json input)
    save("run-1", "Run 1", BODY, seg(1));
    for (const n of [2, 3]) {
      // lib/run.mjs: the runner archives the handover as loaded, then resends task + handover.
      archive(root, null, listWaiting(root, repo).find((h) => h.meta.title === `Run ${n - 1}`).path, { via: "load", owner: "cornerman-run" });
      prompt(`run-${n}`, `Build the order form. Never store card numbers.\n\n---\n\ncornerman: this is segment ${n} of at most 5. The previous segment ran out of context.\n\n# Run`);
      save(`run-${n}`, `Run ${n}`, BODY, seg(n));
      expect(saved(`Run ${n}`)).toContain('"Build the order form. Never store card numbers."');
      expect(saved(`Run ${n}`)).toContain('"Keep the pickup window at 30 minutes."');
    }
  }, GIT_TEST_TIMEOUT);
});

describe("what counts as the user's words", () => {
  it("skips cornerman's own prompts, slash commands and bare acknowledgements, and cuts a runner resume to the task", () => {
    for (const p of [
      "Continue from the cornerman handover that was just loaded.",
      "Write a cornerman handover now, with the /cornerman:handover skill.",
      "/cornerman:handover",
      "<command-name>/clear</command-name>",
      "ok",
      "yes go",
      "Build the order form. Never store card numbers.\n\n---\n\ncornerman: this is segment 2 of at most 5. The previous segment ran out of context and saved the handover below.\n\n# Orders\n## Next action\nRun it.",
      "use pnpm",
      // Since #215 the headless runner resumes with the threshold ask as the user message
      // (found by the cornerman-eval rig proof, 2026-11-16: it landed in "Rulings from the user").
      "cornerman headless mode (context about 300k tokens, threshold 100k, your turn was stopped after a tool call): If your task is finished, do not save a handover, just end. Otherwise commit all your work.",
      "cornerman headless mode (reminder 2 of 3, context about 340k tokens, threshold 100k, your turn was stopped after a tool call): If your task is finished, do not save a handover, just end.",
      "cornerman auto mode (context about 260k tokens, threshold 250k): If your task is finished, do not save a handover, just end.",
    ])
      record(root, "s", p);
    expect(readLog(root, "s").map((e) => e.text)).toEqual(["Build the order form. Never store card numbers.", "use pnpm"]);
  });

  // Field audit 2026-11-28: in the last 14 days 823 of 1,799 logged rulings (46%) were text the
  // harness injected as a user turn, 818 of them <task-notification> blocks from background
  // commands and monitors. They took about half of the section's space and pushed real rules out.
  it("skips a background task's notification, which the harness sends as a user turn", () => {
    record(root, "h", "<task-notification>\n<task-id>b6sfeco92</task-id>\n<summary>Monitor event: \"oven log watch\"</summary>\n<event>batch-7 Exited exit 0</event>\nIf this event is something the user would act on now, send a PushNotification.\n</task-notification>");
    record(root, "h", "Never round prices to the dollar.");
    expect(readLog(root, "h").map((e) => e.text)).toEqual(["Never round prices to the dollar."]);
  });

  it("keeps what the user typed after an injected block, and keeps text the user pasted", () => {
    for (const p of [
      "<ide_opened_file>The user opened src/orders.ts. This may or may not be related.</ide_opened_file>",
      "<ide_selection>The user selected lines 4-9 of src/orders.ts: const x = 1;</ide_selection>\nKeep this constant in cents, not dollars.",
      "<system-reminder>Plan mode is on.</system-reminder> <task-notification><task-id>b9</task-id></task-notification> Always show the pickup time in local time.",
      "<cross-session-message from=\"other\">Never ship the order form on Fridays.</cross-session-message>",
      "<local-command-caveat>DO NOT respond to these messages.</local-command-caveat>",
      "<bash-stdout>12 passed, none failed</bash-stdout><bash-stderr></bash-stderr>",
      '<pasted_content id="p1">Never store card numbers in the order table.</pasted_content> Use this as the rule.',
    ])
      record(root, "k", p);
    expect(readLog(root, "k").map((e) => e.text)).toEqual([
      "Keep this constant in cents, not dollars.",
      "Always show the pickup time in local time.",
      '<pasted_content id="p1">Never store card numbers in the order table.</pasted_content> Use this as the rule.',
    ]);
  });

  // The same audit: handovers saved before this fix already carry these entries, many cut to
  // ENTRY_MAX so the closing tag is gone. Without this every chain would hand them on for good.
  it("drops injected turns already carried in the handover it continues, cut or whole", () => {
    const previous = [
      "# Orders",
      "",
      "## Rulings from the user",
      "Standing rules: each holds for all later work unless a later one replaces it.",
      '- [2026-11-26] "<task-notification> <task-id>bnu6u2j0k</task-id> <status>completed</status> <summary>Monitor stream ended</summary> If this event is something the user would act on now, send a PushNotification. [cut]"',
      '- [2026-11-27] "<task-notification> <task-id>byf</task-id> <status>completed</status> </task-notification>"',
      '- [2026-11-27] "Never email the customer before the baker confirms the order."',
    ].join("\n");
    const out = addRulings("# T", { store: root, session: "none", previous });
    expect(out).toContain('"Never email the customer before the baker confirms the order."');
    expect(out).not.toContain("task-notification");
  });
});

describe("the bounds", () => {
  it("caps the section, dropping task requests before rulings and the oldest first, and an empty log adds nothing", () => {
    expect(addRulings("# T\n\n## Goal\ng", { store: root, session: "none" })).toBe("# T\n\n## Goal\ng");
    const at = (i) => new Date(Date.UTC(2026, 0, 1, 0, i));
    for (let i = 0; i < 80; i++) record(root, "s", i % 2 ? `Never bake batch ${i} above two hundred degrees` : `Look at the batch ${i} oven logs please`, at(i));
    const out = addRulings("# T", { store: root, session: "s" });
    const entries = out.split("\n").filter((l) => l.startsWith("- "));
    expect(entries.length).toBeLessThanOrEqual(MAX_ENTRIES);
    expect(out.length).toBeLessThanOrEqual(MAX_CHARS + 600);
    expect(entries.every((l) => l.includes("Never bake"))).toBe(true);
    expect(entries.at(-1)).toContain("batch 79 ");
    expect(out).toMatch(/older task requests left out/);
  });

  it("drops a standing rule only when the rules alone pass the cap, and then says how many", () => {
    const at = (i) => new Date(Date.UTC(2026, 0, 1, 0, i));
    for (let i = 0; i < 60; i++) record(root, "s", `The oven for batch ${i} runs at ${100 + i} degrees`, at(i));
    const out = addRulings("# T", { store: root, session: "s" });
    expect(out).toContain("batch 59 ");
    expect(out).not.toContain('"The oven for batch 0 ');
    expect(out).toMatch(/20 oldest standing rules left out for space: restate any that still holds/);
  });

  // Found in the plugin sandbox (2026-11-18): one prompt held two rules, and a correction of one
  // marked the whole entry replaced, the API limit with it.
  it("marks a prompt holding other rules as only partly replaced, and keeps it over a cap", () => {
    record(root, "s", "We agreed the API limit: 23 calls a minute per client. Use single quotes for strings in new code.");
    record(root, "s", "Actually, switch to double quotes for strings in new code.");
    const out = addRulings("# T", { store: root, session: "s" });
    expect(out).toMatch(/23 calls a minute per client\. Use single quotes for strings in new code\." \(partly replaced by a later one\)/);
  });

  // Reviewer, 2026-11-18: "Make that 3 spaces" opens with a task verb, so it was listed as a task
  // request, dropped first over a cap, and the 2 spaces rule came back unmarked on the next save.
  it("lists a correction as a standing rule, never a task request", () => {
    record(root, "s", "Indent with 2 spaces in every file.");
    record(root, "s", "Make that 3 spaces.");
    const out = addRulings("# T", { store: root, session: "s" });
    const [rules, requests = ""] = out.split("Task requests");
    expect(rules).toContain('"Make that 3 spaces."');
    expect(requests).not.toContain("3 spaces");
  });

  // Reviewer, 2026-11-18: a standing imperative opens with a task verb too.
  it("lists a standing imperative as a rule even when it opens with a task verb", () => {
    record(root, "s", "Run the linter before every commit.");
    record(root, "s", "Add a retry. Use single quotes only.");
    record(root, "s", "Add applyFee to src/money.js please.");
    const [rules, requests = ""] = addRulings("# T", { store: root, session: "s" }).split("Task requests");
    expect(rules).toContain('"Run the linter before every commit."');
    expect(rules).toContain('"Add a retry. Use single quotes only."');
    expect(requests).toContain("applyFee");
  });

  // Reviewer, 2026-11-18: the two lists reorder entries, and markReplaced only marks earlier ones.
  it("marks the same rules replaced after a save renders and the next save parses them back", () => {
    const at = (i) => new Date(Date.UTC(2026, 0, 1, 0, i));
    record(root, "s", "Fix the login redirect please.", at(0));
    record(root, "s", "Indent with 2 spaces in every file.", at(1));
    record(root, "s", "Update the changelog for the login fix.", at(2));
    record(root, "s", "Make that 3 spaces.", at(3));
    const first = addRulings("# T", { store: root, session: "s" });
    const again = addRulings("# T", { store: root, session: "none", previous: first });
    expect(again).toBe(first);
    expect(first).toMatch(/2 spaces in every file\." \(replaced by a later one\)/);
  });

  // Reviewer, 2026-11-18: "switch to" mid-sentence is not a correction.
  it("does not read a rule that mentions switching as a correction of an earlier one", () => {
    record(root, "s", "Use pnpm for package installs.");
    record(root, "s", "Never switch to yarn for package installs.");
    expect(addRulings("# T", { store: root, session: "s" })).not.toContain("replaced by a later one");
  });

  // Reviewer, 2026-11-18: a dropped replaced ruling was counted as a task request in the header.
  it("counts replaced rulings left out apart from task requests", () => {
    const at = (i) => new Date(Date.UTC(2026, 0, 1, 0, i));
    record(root, "s", "Indent with 2 spaces in every file.", at(0));
    record(root, "s", "Make that 3 spaces.", at(1));
    for (let i = 0; i < 39; i++) record(root, "s", `The oven for batch ${i} runs at ${100 + i} degrees`, at(i + 2));
    const out = addRulings("# T", { store: root, session: "s" });
    expect(out).toMatch(/1 replaced ruling left out/);
    expect(out).not.toMatch(/task request/);
  });

  it("cuts a long prompt to its ruling sentences, in the user's words", () => {
    const noise = "The oven log reads 180 at noon and 175 at one. ".repeat(60);
    record(root, "s", `Here is the log. ${noise}Do not change the proofing times without asking me first. ${noise}Thanks.`);
    const [e] = readLog(root, "s");
    expect(e.text.length).toBeLessThanOrEqual(ENTRY_MAX);
    expect(e.text).toContain("Do not change the proofing times without asking me first.");
    expect(e.text).toContain("[cut]");
  });

  it("keeps the log file itself small however long the session runs", () => {
    for (let i = 0; i < 600; i++) record(root, "s", `Never reuse proofing tray ${i} for the gluten-free loaves, keep them apart on shelf ${i}.`);
    expect(statSync(logPath(root, "s")).size).toBeLessThanOrEqual(LOG_MAX);
    expect(readLog(root, "s").at(-1).text).toContain("tray 599 ");
  });

  it("the store prune removes a session's log a month after its last prompt", () => {
    record(root, "old", "Never sell day-old bread at full price.");
    record(root, "new", "Never sell day-old bread at full price.");
    const monthAgo = (Date.now() - 31 * 86_400_000) / 1000;
    utimesSync(logPath(root, "old"), monthAgo, monthAgo);

    prune({ root });

    expect(existsSync(logPath(root, "old"))).toBe(false);
    expect(existsSync(logPath(root, "new"))).toBe(true);
  });
});
