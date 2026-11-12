// Issue #206: asked for a handover "for the other session", a window saved one with
// --cwd pointing at another repo. Macdara wanted a prompt to paste there, and this
// session to carry on. The skill now decides the kind before it writes anything.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SKILL = join(dirname(fileURLToPath(import.meta.url)), "..", "plugin", "skills", "handover", "SKILL.md");
const text = readFileSync(SKILL, "utf8").replace(/\r\n/g, "\n");

describe("handover skill picks the kind", () => {
  it("decides between a save and a paste-ready prompt before checking facts or saving", () => {
    const pick = text.indexOf("## 0. Pick the kind");
    expect(pick).toBeGreaterThan(-1);
    expect(pick).toBeLessThan(text.indexOf("## 1. Check the facts first"));
    const section = text.slice(pick, text.indexOf("## 1. Check the facts first"));
    expect(section).toMatch(/after `\/clear`/);
    expect(section).toMatch(/paste-ready prompt/);
    expect(section).toMatch(/save nothing/i);
    expect(section).toMatch(/never `--cwd`/i);
    expect(section).toMatch(/AskUserQuestion/);
    expect(section).toMatch(/two options/);
  });
});
