// Issue #204: the SessionStart hook ran 8-27 s on a 2,268-record store and was
// cancelled. The common /clear is the one right after this window saved its
// handover here: that needs no pull from the other machine first.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../plugin/scripts/lib/owner.mjs", async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, ownerOpen: vi.fn(real.ownerOpen) };
});
vi.mock("../plugin/packages/store/sync.mjs", async (importOriginal) => ({ ...(await importOriginal()), isSynced: () => true, pull: vi.fn() }));

const { ownerOpen } = await import("../plugin/scripts/lib/owner.mjs");
const { pull } = await import("../plugin/packages/store/sync.mjs");
const { run } = await import("../plugin/scripts/lib/hook.mjs");
const { saveHandover } = await import("../plugin/scripts/lib/store.mjs");

const START = Date.now() - 60 * 60_000;
const ME = `111@${START}`;

let root, repo, env;
const git = (...args) => execFileSync("git", args, { cwd: repo, stdio: "ignore" });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "cm-store-"));
  repo = mkdtempSync(join(tmpdir(), "cm-repo-"));
  env = { CORNERMAN_HOME: root };
  git("init", "-q", "-b", "main");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init");
  pull.mockClear();
  ownerOpen.mockClear();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

describe("SessionStart cost", () => {
  it("skips the pull when this window's own handover is already here, and pulls when it is not", () => {
    saveHandover({ cwd: repo, title: "Mine", body: "mine body", root, owner: ME });
    expect(run({ cwd: repo, source: "clear" }, { env, me: ME }).systemMessage).toMatch(/loaded handover "Mine"/);
    expect(pull).not.toHaveBeenCalled();

    run({ cwd: repo, source: "startup" }, { env, me: `222@${START}`, now: new Date(Date.now() + 60_000) });
    expect(pull).toHaveBeenCalledTimes(1);
  });

  it("labels the other windows' handovers it lists without reading the process table", () => {
    // Another window, still open: this test process. Saved first, so it is the older one.
    saveHandover({ cwd: repo, title: "Theirs", body: "their body", root, owner: `${process.pid}@${START}` });
    saveHandover({ cwd: repo, title: "Mine", body: "mine body", root, owner: ME });

    const out = run({ cwd: repo, source: "clear" }, { env, me: ME });

    expect(out.systemMessage).toMatch(/loaded handover "Mine"/);
    expect(out.hookSpecificOutput.additionalContext).toMatch(/"Theirs".*belongs to another open window/);
    expect(ownerOpen).not.toHaveBeenCalled();
  });
});
