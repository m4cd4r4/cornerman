// Seed 4 of the cornerman-eval Test 1 batch (2026-11-17), probe "Carry on with the migration
// script". The context crossed the nudge on the first tool call of the turn (a `cat` of the
// script), the mid-turn ask said "finish the current step ... write a handover ... end your
// turn", and the agent saved and ended with "Run /clear" having only read the file. The relay had
// used its 3 clears, so nothing cleared and the task stayed undone. Seed 5 did the same; seed 8,
// with a clear left, was cleared and carried on. Fixture: the relay file and the turn's rows, ids
// neutralised.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMidTurn, runStop } from "../plugin/scripts/lib/nudge.mjs";

const SESSION = "sess-4";
let dir, root, transcript;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cr-noclear-"));
  root = join(dir, "store");
  transcript = join(dir, "t.jsonl");
  // The probe turn as the transcript held it when PostToolUse ran.
  const usage = { input_tokens: 3, cache_creation_input_tokens: 1012, cache_read_input_tokens: 69865, output_tokens: 120 };
  writeFileSync(
    transcript,
    [
      { type: "user", message: { role: "user", content: "Carry on with the migration script in scripts/migrate.mjs." } },
      { type: "assistant", message: { model: "claude-x", usage, content: [{ type: "text", text: "Let me look at the migration script." }] } },
      { type: "assistant", message: { model: "claude-x", usage, content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "ls scripts; cat scripts/migrate.mjs" } }] } },
    ].map((r) => JSON.stringify(r)).join("\n") + "\n",
    "utf8",
  );
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const relay = (used, limit = 3) => {
  mkdirSync(join(root, "relay"), { recursive: true });
  writeFileSync(join(root, "relay", "w1.json"), JSON.stringify({ v: 1, key: "w1", cwd: "/work", sessions: ["sess-1", "sess-2", "sess-3", SESSION], limit, configured: limit, used, stalled: 0, applied: 0, updatedAt: 1 }));
};
// The rig: auto mode on, relay on with its default budget of 3, nudge at 70k.
const env = () => ({ CORNERMAN_AUTO: "1", CORNERMAN_HOME: root, CORNERMAN_NUDGE_AT: "70000", CLAUDE_PLUGIN_OPTION_RELAY: "3" });
const input = () => ({ session_id: SESSION, transcript_path: transcript });

describe("seed 4: the nudge when the relay has no clear left", () => {
  it("fix 5: does not ask mid-turn, so the user's request is not dropped for a handover", () => {
    relay(3);
    expect(runMidTurn(input(), { env: env() })).toBeNull();
  });

  // Fault 7 of stage A (2026-11-18): in every trial the final session crossed the nudge at a turn
  // end with no clear left; the agent saved a fourth handover and wrote "type /clear", and nothing
  // cleared. Only the user can clear now, so the user is told, once, and Claude is not asked.
  it("at the turn end asks Claude nothing, and tells the user once that only they can clear now", () => {
    relay(3);
    runMidTurn(input(), { env: env() });
    const out = runStop(input(), { env: env() });
    expect(out.hookSpecificOutput).toBeUndefined();
    expect(out.systemMessage).toMatch(/no clears? left/);
    expect(out.systemMessage).toContain("/cornerman:handover");
    expect(out.systemMessage).toContain("/clear");
    expect(runStop(input(), { env: env() })).toBeNull();
  });

  it("with a clear left (seed 8), or a newer budget waiting, still asks mid-turn and lets the relay clear", () => {
    relay(2);
    expect(runMidTurn(input(), { env: env() }).hookSpecificOutput.additionalContext).toContain("end your turn with no further tool calls");
    rmSync(join(root, ".nudged"), { recursive: true, force: true });
    relay(3);
    writeFileSync(join(root, "relay", "w1.set.json"), JSON.stringify({ limit: 2, at: 5 }));
    expect(runMidTurn(input(), { env: env() })).not.toBeNull();
  });
});
