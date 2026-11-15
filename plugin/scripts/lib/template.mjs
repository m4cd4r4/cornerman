// The handover template, from one source: the fenced markdown block in the handover
// skill's "Write it" step (skills/handover/SKILL.md). The interactive paths run the
// skill itself; the headless ask (nudge.mjs) cannot, so it embeds this block. It used
// to ask only for "the single next action and any open STOP question", and a headless
// clear dropped every decision and do-not the user gave in chat (quality-1m fill dial,
// 2026-11-15). Reading the block from the skill keeps the two paths from drifting.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SKILL_PATH = fileURLToPath(new URL("../../skills/handover/SKILL.md", import.meta.url));

/** The skill's markdown template, or "" when the skill cannot be read. Never throws. */
export function handoverTemplate(path = SKILL_PATH) {
  try {
    const m = /```markdown\n([\s\S]*?)\n```/.exec(readFileSync(path, "utf8").replace(/\r\n/g, "\n"));
    return m ? m[1].trim() : "";
  } catch {
    return "";
  }
}
