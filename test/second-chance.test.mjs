// Issue #204: a SessionStart hook that is cancelled, times out or crashes loads
// nothing, and the window's own handover then waits unseen while the auto-resume
// prompt says it was loaded. 15 of 289 /clears (29 Oct - 12 Nov 2026). The first
// prompt of the session gets a second chance at this window's own handover.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { markStarted, run as promptRun } from "../plugin/scripts/lib/second-chance.mjs";
import { listWaiting, saveHandover } from "../plugin/scripts/lib/store.mjs";
import { listAll } from "../plugin/packages/store/store.mjs";

// The script writes the output, then settles the load; a direct call stands in for both.
const settle = (out) => {
  out?.afterOutput?.();
  return out;
};
// Every window here started an hour ago, before any handover in a test was saved.
const START = Date.now() - 60 * 60_000;
const ownerOf = (pid) => `${pid}@${START}`;

let root, repo, transcript, env;
const git = (...args) => execFileSync("git", args, { cwd: repo, stdio: "ignore" });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "cm-store-"));
  repo = mkdtempSync(join(tmpdir(), "cm-repo-"));
  transcript = join(root, "transcript.jsonl");
  // A cleared session's transcript before its first reply: the /clear, no assistant turn.
  writeFileSync(transcript, `${JSON.stringify({ type: "user", message: { content: "<command-name>/clear</command-name>" } })}\n`);
  env = { CORNERMAN_HOME: root };
  git("init", "-q", "-b", "main");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

const prompt = (sessionId, me) =>
  settle(promptRun({ session_id: sessionId, cwd: repo, transcript_path: transcript, prompt: "Continue from the cornerman handover that was just loaded." }, { env, me }));

describe("second-chance load on the first prompt", () => {
  it("loads this window's own handover when SessionStart delivered nothing", () => {
    saveHandover({ cwd: repo, title: "Mine", body: "## Next action\nRun the tests.", root, owner: ownerOf(111) });

    const out = prompt("s1", ownerOf(111));

    expect(out.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
    expect(out.hookSpecificOutput.additionalContext).toContain("Run the tests.");
    expect(out.hookSpecificOutput.additionalContext).toContain('Resuming handover "Mine".');
    expect(out.systemMessage).toMatch(/loaded handover "Mine"/);
    expect(listWaiting(root, repo)).toHaveLength(0);
    expect(listAll(root).find((r) => r.title === "Mine").archivedBy.via).toBe("hook");
  });

  it("does nothing when SessionStart already delivered for this session", () => {
    saveHandover({ cwd: repo, title: "Mine", body: "body", root, owner: ownerOf(111) });
    markStarted(root, "s1");

    expect(prompt("s1", ownerOf(111))).toBeNull();
    expect(listWaiting(root, repo)).toHaveLength(1);
  });

  it("never loads into a session that already has a reply (a resumed one), and checks only the first prompt", () => {
    saveHandover({ cwd: repo, title: "Mine", body: "body", root, owner: ownerOf(111) });
    writeFileSync(transcript, `${JSON.stringify({ type: "assistant", message: { content: "earlier reply" } })}\n`, { flag: "a" });

    expect(prompt("s1", ownerOf(111))).toBeNull();
    writeFileSync(transcript, "");
    expect(prompt("s1", ownerOf(111))).toBeNull();
    expect(listWaiting(root, repo)).toHaveLength(1);
  });

  it("three windows in one folder: each first prompt takes its own handover and nobody else's", () => {
    saveHandover({ cwd: repo, title: "A work", body: "a body", root, owner: ownerOf(111) });
    saveHandover({ cwd: repo, title: "B work", body: "b body", root, owner: ownerOf(222) });
    saveHandover({ cwd: repo, title: "C work", body: "c body", root, owner: ownerOf(333) });

    const b = prompt("sb", ownerOf(222));
    expect(b.hookSpecificOutput.additionalContext).toContain("b body");
    expect(b.hookSpecificOutput.additionalContext).not.toContain("a body");
    expect(b.hookSpecificOutput.additionalContext).not.toContain("c body");
    expect(listWaiting(root, repo).map((h) => h.meta.title)).toEqual(["A work", "C work"]);

    const c = prompt("sc", ownerOf(333));
    expect(c.hookSpecificOutput.additionalContext).toContain("c body");
    expect(listWaiting(root, repo).map((h) => h.meta.title)).toEqual(["A work"]);

    // A fourth window with no handover of its own takes nothing, not even the lone one left.
    expect(prompt("sd", ownerOf(444))).toBeNull();
    expect(listWaiting(root, repo).map((h) => h.meta.title)).toEqual(["A work"]);
  });
});

describe("the hook scripts", () => {
  const SCRIPTS = join(import.meta.dirname, "..", "plugin", "scripts");
  const runScript = (name, input) =>
    execFileSync(process.execPath, [join(SCRIPTS, name)], {
      input: typeof input === "string" ? input : JSON.stringify(input),
      env: { ...process.env, CORNERMAN_HOME: root, CORNERMAN_SYNC: "off" },
      encoding: "utf8",
    });

  it("a SessionStart that delivered, or had nothing to deliver, marks the session; the first prompt then does nothing", () => {
    // Nothing to load (a first run prints only the welcome notice).
    expect(runScript("session-start.mjs", { cwd: repo, source: "clear", session_id: "s2" })).not.toContain("loaded handover");
    expect(existsSync(markStarted.path(root, "s2"))).toBe(true);
    saveHandover({ cwd: repo, title: "Mine", body: "start body", root, owner: "" });
    expect(runScript("session-start.mjs", { cwd: repo, source: "clear", session_id: "s1" })).toContain("start body");
    expect(existsSync(markStarted.path(root, "s1"))).toBe(true);

    expect(runScript("prompt-submit.mjs", { cwd: repo, session_id: "s1", transcript_path: transcript })).toBe("");
    expect(runScript("prompt-submit.mjs", "not json")).toBe("");
  });
});
