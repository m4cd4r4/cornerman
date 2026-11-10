// Carry-forward (#194): an open item in one handover never drops out of the next
// one silently. The chain test is the issue's own acceptance test: decided items, an
// unanswered question and a progress number survive two more save/load cycles
// that each only touch one narrow item.
// tdd-guard:allow - backfilled onto lib/carry.mjs, written in the same change.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CARRIED_HEADING, carryForward, missingSections, openCount, openItems, previousHandover } from "../plugin/scripts/lib/carry.mjs";
import { archive, listLoaded, listWaiting, saveHandover } from "../plugin/scripts/lib/store.mjs";
import { sameOwner } from "../plugin/scripts/lib/owner.mjs";
import { loadedCopyText } from "../plugin/packages/store/loaded.mjs";

const FIRST = `# ERF CSS trim

## Goal
Remove all custom CSS from the client site.

## Next action
Delete the .hero-eyebrow rule in custom.css.

## Read first
- docs/clients/erf/decisions.md - 10 rulings, 7 not yet applied
- docs/clients/erf/CLAUDE.md - workspace map, the do-not list

## Progress
490 -> 483 lines, target ~0.

## Decided, not yet applied
- Delete the footer-social block rules (ruled in decisions.md #4)
- Drop the gallery hover zoom, the built-in look is fine
- Trimmed stylesheet trim-v2.css is built but not applied

## Open questions
- Four-option button comparison page shown, no answer recorded (review/buttons.html)

## Key files
- custom.css - the live stylesheet
`;

const narrow = (n) => `# ERF CSS trim

## Goal
Remove all custom CSS from the client site.

## Next action
Delete rule number ${n} in custom.css, the narrow item in hand.

## State
- Removed one rule.
`;

describe("openItems", () => {
  it("reads decided items, open questions and progress, one per bullet", () => {
    const items = openItems(FIRST);
    expect(items.map((i) => i.tag)).toEqual(["read first", "read first", "progress", "decided", "decided", "decided", "open question"]);
    expect(openCount(FIRST)).toBe(4);
  });

  it("treats None as no item", () => {
    expect(openItems("## Decided, not yet applied\nNone\n\n## Open questions\nNone.\n")).toEqual([]);
  });
});

describe("carryForward", () => {
  it("appends every open item the new handover dropped", () => {
    const { body, carried } = carryForward(narrow(1), { title: "ERF CSS trim", body: FIRST });
    expect(carried).toHaveLength(7);
    expect(body).toContain("- [read first] docs/clients/erf/decisions.md - 10 rulings, 7 not yet applied");
    expect(body).toContain(`## ${CARRIED_HEADING}`);
    expect(body).toContain("- [decided] Delete the footer-social block rules (ruled in decisions.md #4)");
    expect(body).toContain("- [open question] Four-option button comparison page");
    expect(body).toContain("- [progress] 490 -> 483 lines, target ~0.");
  });

  it("does not carry an item the new handover restates or marks done", () => {
    const next = `${narrow(1)}\n## Done\n- Footer-social block rules deleted, verified.\n- Gallery hover zoom dropped.\n`;
    const texts = carryForward(next, { body: FIRST }).carried.map((c) => c.text);
    expect(texts.some((t) => /footer-social/.test(t))).toBe(false);
    expect(texts.some((t) => /gallery hover/i.test(t))).toBe(false);
    expect(texts.some((t) => /trim-v2/.test(t))).toBe(true);
  });

  it("carries nothing when the new handover keeps everything", () => {
    const { body, carried } = carryForward(FIRST, { body: FIRST });
    expect(carried).toEqual([]);
    expect(body).not.toContain(CARRIED_HEADING);
  });

  it("never stacks two carried sections", () => {
    const once = carryForward(narrow(1), { body: FIRST }).body;
    const twice = carryForward(`${once}\n`, { body: once }).body;
    expect(twice.split(CARRIED_HEADING).length - 1).toBe(1);
  });
});

describe("previousHandover", () => {
  const h = (id, owner, archivedAt) => ({ id, archivedBy: { owner }, archivedAt, meta: { created: archivedAt } });
  const now = new Date("2026-11-10T12:00:00Z");

  it("picks the newest handover this window loaded, over another window's", () => {
    const loaded = [h("a", "10@1", "2026-11-09T10:00:00Z"), h("b", "10@1", "2026-11-10T10:00:00Z"), h("c", "99@1", "2026-11-10T11:00:00Z")];
    expect(previousHandover({ loaded, owner: "10@1", sameOwner, now }).id).toBe("b");
  });

  it("prefers this window's own newer waiting handover", () => {
    const own = [{ id: "w", meta: { created: "2026-11-10T11:30:00Z" } }];
    expect(previousHandover({ own, loaded: [h("b", "10@1", "2026-11-10T10:00:00Z")], owner: "10@1", sameOwner, now }).id).toBe("w");
  });

  it("ignores old loads and an unknown owner", () => {
    expect(previousHandover({ loaded: [h("o", "10@1", "2026-10-01T11:00:00Z")], owner: "10@1", sameOwner, now })).toBeNull();
    expect(previousHandover({ loaded: [h("b", "10@1", "2026-11-10T10:00:00Z")], owner: "", sameOwner, now })).toBeNull();
  });
});

describe("missingSections", () => {
  it("names the always-present sections a body lacks", () => {
    expect(missingSections(narrow(1))).toEqual(["Read first", "Decided, not yet applied", "Open questions"]);
    expect(missingSections(FIRST)).toEqual([]);
  });
});

describe("chain: three save/load cycles", () => {
  let root, repo;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "cm-carry-"));
    repo = mkdtempSync(join(tmpdir(), "cm-carry-repo-"));
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: repo });
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "i"], { cwd: repo });
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  });

  it("the third session still sees the decided items, the question and the progress", () => {
    const owner = "4242@1000";
    let body = FIRST;
    for (let cycle = 1; cycle <= 3; cycle++) {
      if (cycle > 1) {
        const previous = previousHandover({ own: [], loaded: listLoaded(root, repo), owner, sameOwner });
        expect(previous).not.toBeNull();
        body = carryForward(narrow(cycle), { title: previous.meta.title, body: previous.body }).body;
      }
      saveHandover({ cwd: repo, title: `ERF CSS trim ${cycle}`, body, root, owner: "", now: new Date(Date.now() + cycle * 1000) });
      const [waiting] = listWaiting(root, repo);
      archive(root, null, waiting.path, { via: "hook", owner });
    }
    const last = listLoaded(root, repo).at(-1);
    for (const s of ["docs/clients/erf/decisions.md", "docs/clients/erf/CLAUDE.md", "Delete the footer-social block rules", "Drop the gallery hover zoom", "trim-v2.css is built but not applied", "Four-option button comparison page", "490 -> 483 lines, target ~0.", "Delete rule number 3"])
      expect(last.body).toContain(s);
    expect(last.body.split(CARRIED_HEADING).length - 1).toBe(1);
  });
});

describe("save.mjs and the loaded copy", () => {
  it("save.mjs warns when the always-present sections are missing", () => {
    const root = mkdtempSync(join(tmpdir(), "cm-carry-cli-"));
    const repo = mkdtempSync(join(tmpdir(), "cm-carry-cli-repo-"));
    try {
      execFileSync("git", ["init", "-q", "-b", "main"], { cwd: repo });
      const out = execFileSync(process.execPath, [join(import.meta.dirname, "../plugin/scripts/save.mjs"), "--title", "t", "--cwd", repo], {
        cwd: repo,
        input: narrow(1),
        env: { ...process.env, CORNERMAN_HOME: root, CORNERMAN_TRAIL: "0" },
        encoding: "utf8",
      });
      expect(out).toContain('no "Read first" or "Decided, not yet applied" or "Open questions" section');
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("the loaded copy says which session it belongs to (#198)", () => {
    const text = loadedCopyText({ id: "x", title: "T", repoPath: "/r", createdAt: "2026-11-10T00:00:00Z", body: "b", loadedBy: "244a11a0" });
    expect(text).toContain("Loaded into session: 244a11a0");
    expect(text).toContain("If that is not your session, it is not your handover");
  });
});
