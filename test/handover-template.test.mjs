// One handover template for both paths. The headless ask (nudge.mjs) used to ask only
// for "the single next action and any open STOP question", bypassing the skill's
// sections, so a headless clear dropped every decision and do-not the user gave in chat
// (quality-1m fill dial, 2026-11-15). The ask now carries the skill's own template,
// read from SKILL.md, so the two cannot drift.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMidTurn, runStop } from "../plugin/scripts/lib/nudge.mjs";

const SKILL = fileURLToPath(new URL("../plugin/skills/handover/SKILL.md", import.meta.url));
const call = (ctx) =>
  JSON.stringify({ type: "assistant", message: { model: "claude-x", usage: { input_tokens: 10, cache_creation_input_tokens: 90, cache_read_input_tokens: ctx - 100 } } });

let dir, transcript;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cr-tpl-"));
  transcript = join(dir, "t.jsonl");
  writeFileSync(transcript, call(300_000) + "\n", "utf8");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

// The headings of the fenced markdown template in the skill's "Write it" step.
const skillHeadings = () => {
  const block = /```markdown\n([\s\S]*?)\n```/.exec(readFileSync(SKILL, "utf8").replace(/\r\n/g, "\n"))[1];
  return [...block.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
};

describe("the headless ask", () => {
  it("carries every section of the handover skill's template, at a turn end and mid-turn", () => {
    expect(skillHeadings()).toEqual(expect.arrayContaining(["Goal", "Next action", "Decided, not yet applied", "Decisions already made", "Do not"]));
    const env = { CORNERMAN_AUTO: "1", CORNERMAN_HEADLESS: "1", CORNERMAN_HOME: join(dir, "store"), CORNERMAN_NUDGE_AT: "180000" };
    for (const [fn, id] of [[runStop, "s1"], [runMidTurn, "s2"]]) {
      const ask = fn({ session_id: id, transcript_path: transcript }, { env }).hookSpecificOutput.additionalContext;
      for (const h of skillHeadings()) expect(ask).toContain(`## ${h}`);
      expect(ask).toContain("save.mjs");
    }
  });
});
