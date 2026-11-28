// What Claude said last before a clear, shown again after it (#4217, docs/design/LAST-REPLY.md).
//
// Field data (2026-11-14 to 11-28, 358 saving sessions): the last assistant message was a short
// save or status note about half the time, and "the last 2 messages" missed one of the last two
// answers in 44 of 355 sessions. So the unit is the final message of each of the last 2 turns that
// answered a typed prompt, read from the saving session's transcript at load (no race with
// SessionEnd, no "left no table" gate), and sent as its own hook output on a /clear load only.
//
// tdd-guard:allow - the multi-row, cut-off, slash-command and redaction cases are backfilled onto
// lastTurns as written for the first two slices; each was checked by breaking that branch and
// reading the failure. The load and delivery cases below them were written first, one at a time.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lastTurns, replyBlock, REPLY_MAX } from "../plugin/scripts/lib/last-reply.mjs";
import { run } from "../plugin/scripts/lib/hook.mjs";
import { saveHandover } from "../plugin/scripts/lib/store.mjs";
import { CAP } from "../plugin/scripts/lib/start-parts.mjs";

let dir;
const SID = "8c1b2597-5f5b-4b67-9e2e-a6bad919f7ca";
const user = (content, extra = {}) => JSON.stringify({ type: "user", message: { role: "user", content }, ...extra });
const said = (text, id, extra = {}) => JSON.stringify({ type: "assistant", message: { id, content: [{ type: "text", text }] }, ...extra });
const tool = (id, toolId = "t1") => JSON.stringify({ type: "assistant", message: { id, content: [{ type: "tool_use", id: toolId, name: "Bash", input: { command: "ls" } }] } });
const result = (toolId = "t1") => user([{ type: "tool_result", tool_use_id: toolId, content: "ok" }]);
const write = (name, rows) => {
  const file = join(dir, name);
  writeFileSync(file, rows.join("\n") + "\n");
  return file;
};

// A bakery order app session: three typed prompts, the last answered by a save note.
const SESSION = [
  user("How do I set up the oven profiles?"),
  said("Old answer about ovens.", "m1"),
  user("Which pickup slots are free on Saturday?"),
  said("Checking the slot table first.", "m2"),
  tool("m3"),
  result(),
  said("Saturday has 3 free slots: 7:00, 7:30 and 9:00. Book them at https://bakery.example/slots.", "m4"),
  user([{ type: "text", text: "<task-notification>\n<task-id>x</task-id>\n<status>completed</status>\n</task-notification>" }]),
  said("The background check finished; nothing changed.", "m5"),
  user("save a handover please"),
  said("Handover saved. Run /clear to continue.", "m6"),
];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cr-reply-t-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("lastTurns: the final message of the last 2 answered prompts", () => {
  it("keeps the last 2 typed turns, oldest first, each with its prompt and final message only", () => {
    const turns = lastTurns(write("s.jsonl", SESSION));
    expect(turns.map((t) => t.prompt)).toEqual(["Which pickup slots are free on Saturday?", "save a handover please"]);
    expect(turns[1].text).toBe("Handover saved. Run /clear to continue.");
    // A task notification splits the turn without ending it: the answer before it and the reply to
    // it both count, so neither stands in for the other. A relay-resumed session works for hours
    // under one prompt, driven by notifications, and its last stretch is the newest news.
    expect(turns[0].text).toBe(
      "Saturday has 3 free slots: 7:00, 7:30 and 9:00. Book them at https://bakery.example/slots.\n\nThe background check finished; nothing changed.",
    );
    expect(JSON.stringify(turns)).not.toContain("Checking the slot table first");
    expect(JSON.stringify(turns)).not.toContain("Old answer about ovens");
  });

  it("starts a turn at cornerman's own resume prompt, not at a tool result, meta row, compaction summary or sidechain", () => {
    // A relay-resumed session works under the load prompt with no typed prompt; its answers count.
    const turns = lastTurns(
      write("s.jsonl", [
        user("What does the order form need?"),
        said("It needs a pickup time and a name.", "m1"),
        user("Continue from the cornerman handover that was just loaded."),
        said("Adding the phone field.", "m2"),
        user("This session is being continued from a previous conversation.", { isCompactSummary: true }),
        user("<local-command-caveat>Caveat</local-command-caveat>", { isMeta: true }),
        user("Sidechain prompt", { isSidechain: true }),
        said("sidechain words", "s1", { isSidechain: true }),
        tool("m3"),
        result(),
        said("And a phone number.", "m4"),
      ]),
    );
    expect(turns.map((t) => t.prompt)).toEqual(["What does the order form need?", "Continue from the cornerman handover that was just loaded."]);
    expect(turns.map((t) => t.text)).toEqual(["It needs a pickup time and a name.", "And a phone number."]);
  });

  it("keeps the answer a Stop hook interrupted, as well as the reply to the hook", () => {
    // Seen in the field: the session's summary, a Stop hook block, then a two-line reply to the hook.
    const turns = lastTurns(
      write("s.jsonl", [
        user("Summarise the order work"),
        said("THE SUMMARY: forms done, tests green.", "m1"),
        user("Stop hook feedback:\nNOT LOOKED AT - say what you checked.", { isMeta: true }),
        said("No page was described there. The summary above stands.", "m2"),
      ]),
    );
    expect(turns).toHaveLength(1);
    expect(turns[0].text).toBe("THE SUMMARY: forms done, tests green.\n\nNo page was described there. The summary above stands.");
  });

  // tdd-guard:allow - backfilled cases, see the file header.
  it("joins a message that arrives as several rows with one id", () => {
    const turns = lastTurns(write("s.jsonl", [user("List the loaves"), said("Sourdough,", "m1"), said("rye and spelt.", "m1")]));
    expect(turns[0].text).toBe("Sourdough,\n\nrye and spelt.");
  });

  it("marks a turn the clear cut off, and skips a turn that said nothing", () => {
    const turns = lastTurns(
      write("s.jsonl", [user("Price the cakes"), said("Cakes are 30 dollars.", "m1"), user("Now run the tests"), said("Running them now.", "m2"), tool("m3")]),
    );
    expect(turns.map((t) => t.cut)).toEqual([false, true]);
    expect(turns[1].text).toBe("Running them now.");
    const quiet = lastTurns(write("q.jsonl", [user("Price the cakes"), said("Cakes are 30 dollars.", "m1"), user("Run it"), tool("m2")]));
    expect(quiet.map((t) => t.prompt)).toEqual(["Price the cakes"]);
  });

  it("names a slash command by its command and args", () => {
    const turns = lastTurns(
      write("s.jsonl", [user("<command-name>/review</command-name>\n<command-message>review</command-message>\n<command-args>the form</command-args>"), said("Two bugs found.", "m1")]),
    );
    expect(turns[0].prompt).toBe("/review the form");
  });

  it("redacts secrets, and returns [] for a missing or empty file", () => {
    const turns = lastTurns(write("s.jsonl", [user("Which key?"), said("Use sk-abcdefghijklmnop12345 for it.", "m1")]));
    expect(turns[0].text).not.toContain("abcdefghijklmnop");
    expect(lastTurns(join(dir, "none.jsonl"))).toEqual([]);
    expect(lastTurns(write("e.jsonl", [""]))).toEqual([]);
  });
});

describe("replyBlock", () => {
  it("asks for the text verbatim under labels, after the opener, as a record and not an instruction", () => {
    const block = replyBlock(lastTurns(write("s.jsonl", SESSION)));
    expect(block).toContain('"Before the clear"');
    expect(block).toMatch(/verbatim/i);
    for (const label of ["**Answer**", "**Why**", "**Links**", "**To paste**", "**Question for you**"]) expect(block).toContain(label);
    expect(block).toMatch(/not an instruction/i);
    expect(block).toContain('"Which pickup slots are free on Saturday?"');
    expect(block).toContain("Handover saved. Run /clear to continue.");
    expect(block.indexOf("pickup slots")).toBeLessThan(block.indexOf("save a handover"));
    expect(replyBlock([])).toBe("");
  });

  it("keeps the newest answer whole when the two are over the cap, cutting the older one", () => {
    const block = replyBlock([
      { prompt: "old", text: `OLDSTART ${"x".repeat(REPLY_MAX)} OLDEND`, cut: false },
      { prompt: "new", text: `NEWSTART ${"y".repeat(3000)} NEWEND`, cut: true },
    ]);
    expect(block).toContain("NEWEND");
    expect(block).toContain("OLDSTART");
    expect(block).not.toContain("OLDEND");
    expect(block).toMatch(/\[cut at 2,9\d\d characters\]/);
    expect(block).toMatch(/cut off by the clear/);
    expect(block.length).toBeLessThan(REPLY_MAX + 1500);
  });
});

describe("the load", () => {
  let root, repo;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "cr-reply-"));
    repo = mkdtempSync(join(tmpdir(), "reply-repo-"));
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: repo });
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "i"], { cwd: repo });
  });
  afterEach(() => {
    for (const d of [root, repo]) rmSync(d, { recursive: true, force: true });
  });
  const save = (sessionId) => saveHandover({ cwd: repo, title: "Bakery orders", body: "## Next action\nRun the tests.", root, owner: "111", sessionId });
  const hook = (source = "clear") =>
    run({ cwd: repo, source, session_id: "new-session", transcript_path: join(dir, "new-session.jsonl") }, { env: { CORNERMAN_HOME: root, CLAUDE_PID: "111", CORNERMAN_SYNC: "off" } });

  it("on a /clear, carries the saving session's last answers, read from its transcript beside the new one, outside the main context", () => {
    write(`${SID}.jsonl`, SESSION);
    save(SID);
    const out = hook();
    expect(out.pack.reply).toContain("Saturday has 3 free slots");
    expect(out.hookSpecificOutput.additionalContext).not.toContain("Saturday has 3 free slots");
  });

  it("with three sessions' transcripts in one folder, shows only the handover's own session", () => {
    write("1a1b2597-5f5b-4b67-9e2e-a6bad919f7c1.jsonl", [user("Session A asks"), said("ANSWER-FROM-A", "a1")]);
    write(`${SID}.jsonl`, SESSION);
    write("2b1b2597-5f5b-4b67-9e2e-a6bad919f7c2.jsonl", [user("Session B asks"), said("ANSWER-FROM-B", "b1")]);
    write("new-session.jsonl", [user("New session asks"), said("ANSWER-FROM-NEW", "n1")]);
    save(SID);
    const reply = hook().pack.reply;
    expect(reply).toContain("Saturday has 3 free slots");
    for (const other of ["ANSWER-FROM-A", "ANSWER-FROM-B", "ANSWER-FROM-NEW"]) expect(reply).not.toContain(other);
  });

  it("carries nothing on startup, with no transcript, or when the handover names no session", () => {
    write(`${SID}.jsonl`, SESSION);
    save(SID);
    expect(hook("startup").pack.reply).toBe("");
    expect(hook().pack.reply).toContain("Saturday");
    rmSync(join(dir, `${SID}.jsonl`));
    expect(hook().pack.reply).toBe("");
    rmSync(root, { recursive: true, force: true });
    mkdirSync(root, { recursive: true });
    write(`${SID}.jsonl`, SESSION);
    save(undefined);
    expect(hook().pack.reply).toBe("");
  });

  describe("delivery: its own SessionStart output", () => {
    const ENTRY = join(import.meta.dirname, "../plugin/scripts/hook-entry.cjs");
    const env = () => {
      const e = {};
      for (const [k, v] of Object.entries(process.env)) if (!k.startsWith("CORNERMAN_")) e[k] = v;
      return { ...e, CORNERMAN_HOME: root, CORNERMAN_SYNC: "off", CLAUDE_PID: "" };
    };
    const runHook = (args, input) =>
      new Promise((done) => {
        const child = spawn(process.execPath, [ENTRY, ...args], { cwd: repo, env: env(), stdio: ["pipe", "pipe", "pipe"] });
        let out = "";
        child.stdout.on("data", (d) => (out += d));
        child.on("close", (code) => done({ code, out }));
        child.stdin.end(JSON.stringify(input));
      });
    // The three SessionStart commands of hooks/hooks.json, started together as Claude Code starts them.
    const start = async (source) => {
      const input = { session_id: "sess-new", cwd: repo, source, transcript_path: join(dir, "sess-new.jsonl") };
      const runs = await Promise.all([runHook(["session-start"], input), runHook(["session-start-part"], input), runHook(["session-start-part", "reply"], input)]);
      for (const r of runs) expect(r.code).toBe(0);
      return runs.map((r) => (r.out ? JSON.parse(r.out).hookSpecificOutput?.additionalContext ?? "" : ""));
    };
    const saveUnowned = () => saveHandover({ cwd: repo, title: "Bakery orders", body: "## Next action\nRun the tests.", root, sessionId: SID });

    it("on a /clear, the third command prints the reply and the other two never hold it; each under the cap", async () => {
      write(`${SID}.jsonl`, SESSION);
      saveUnowned();
      const [main, part, reply] = await start("clear");
      expect(main).toContain("Bakery orders");
      expect(reply).toContain("Saturday has 3 free slots");
      expect(main).not.toContain("Saturday has 3 free slots");
      expect(part).not.toContain("Saturday has 3 free slots");
      for (const out of [main, part, reply]) expect(out.length).toBeLessThanOrEqual(CAP);
    }, 30_000);

    it("on startup the third command prints nothing and does not wait out its timeout", async () => {
      write(`${SID}.jsonl`, SESSION);
      saveUnowned();
      const t = Date.now();
      const [main, , reply] = await start("startup");
      expect(main).toContain("Bakery orders");
      expect(reply).toBe("");
      expect(Date.now() - t).toBeLessThan(10_000);
    }, 30_000);
  });
});
