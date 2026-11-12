// Issue #205: a window filed its handover for another repo. On the next /clear the
// hook named a handover filed elsewhere only when this repo had none waiting, and
// three stale ones here (49-55 days old, other windows') were listed instead.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run as hookRun } from "../plugin/scripts/lib/hook.mjs";
import { listWaiting, saveHandover } from "../plugin/scripts/lib/store.mjs";
import { listAll } from "../plugin/packages/store/store.mjs";

const run = (input, opts) => {
  const out = hookRun(input, opts);
  out?.afterOutput?.();
  return out;
};
const START = Date.now() - 60 * 60_000;
const ME = `111@${START}`;
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);

let root, repo, other, env;
const gitIn = (cwd, ...args) => execFileSync("git", args, { cwd, stdio: "ignore" });
const newRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), "cm-repo-"));
  gitIn(dir, "init", "-q", "-b", "main");
  gitIn(dir, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init");
  return dir;
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "cm-store-"));
  repo = newRepo();
  other = newRepo();
  env = { CORNERMAN_HOME: root };
});

afterEach(() => {
  for (const d of [root, repo, other]) rmSync(d, { recursive: true, force: true });
});

describe("a handover filed for another repo", () => {
  it("names this window's own handover filed elsewhere, and archives the stale ones here instead of listing them", () => {
    for (const [i, n] of [49, 52, 55].entries()) saveHandover({ cwd: repo, title: `Old ${i}`, body: "old", root, owner: `99${i}@1`, now: daysAgo(n) });
    saveHandover({ cwd: other, title: "Filed elsewhere", body: "elsewhere body", root, owner: ME });

    const out = run({ cwd: repo, source: "clear" }, { env, me: ME });

    expect(out.systemMessage).toContain('"Filed elsewhere"');
    expect(out.systemMessage).toContain(basename(other));
    expect(out.systemMessage.split("\n")).toHaveLength(1);
    expect(out.hookSpecificOutput.additionalContext).not.toContain("elsewhere body");
    expect(out.hookSpecificOutput.additionalContext).not.toMatch(/Old \d/);
    expect(listWaiting(root, repo)).toHaveLength(0);
    expect(listAll(root).filter((r) => r.title.startsWith("Old")).map((r) => r.archivedBy?.via)).toEqual(["stale", "stale", "stale"]);
  });
});
