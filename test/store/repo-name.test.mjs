// tdd-guard:allow (backfill: repo-name.mjs was written after the first case, from the real-store findings below; each case was checked to fail against a broken namer)
// The repo a window's folder belongs to, for /cornerman:stats and the sidebar. Found
// 2026-11-13 on a copy of a real store: naming a repo by its folder's last name gave 120
// rows, "web" merging three repos, worktrees and subfolders split from their repo, and
// 17 windows started in a system folder listed as a repo of their own.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NO_REPO, repoNamer } from "../../plugin/packages/store/repo-name.mjs";

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "cr-repo-name-"));
  // A repo, a linked worktree of it beside it, and a folder that is in no repo.
  mkdirSync(join(root, "repo-a", ".git", "worktrees", "repo-a-feature"), { recursive: true });
  mkdirSync(join(root, "repo-a", "packages", "web", "src"), { recursive: true });
  mkdirSync(join(root, "repo-a-feature"), { recursive: true });
  writeFileSync(join(root, "repo-a-feature", ".git"), `gitdir: ${join(root, "repo-a", ".git", "worktrees", "repo-a-feature")}\n`);
  mkdirSync(join(root, "repo-b", ".git"), { recursive: true });
  mkdirSync(join(root, "repo-b", "web"), { recursive: true });
  mkdirSync(join(root, "plain"), { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("repoNamer", () => {
  it("names the repo for its own folder and any folder inside it", () => {
    const name = repoNamer();
    expect(name(join(root, "repo-a"))).toBe("repo-a");
    expect(name(join(root, "repo-a", "packages", "web", "src"))).toBe("repo-a");
  });

  it("does not merge two repos' folders that share a last name", () => {
    const name = repoNamer();
    expect(name(join(root, "repo-a", "packages", "web"))).toBe("repo-a");
    expect(name(join(root, "repo-b", "web"))).toBe("repo-b");
  });

  it("names a linked worktree by the repo it belongs to", () => {
    expect(repoNamer()(join(root, "repo-a-feature"))).toBe("repo-a");
  });

  it("names a removed worktree by the repo beside it whose name it starts with", () => {
    const name = repoNamer();
    expect(name(join(root, "repo-a-gone"))).toBe("repo-a");
    expect(name(join(root, "repo-a-gone", "docs"))).toBe("repo-a");
  });

  it("puts a folder that is in no repo under one row", () => {
    expect(repoNamer()(join(root, "plain"))).toBe(NO_REPO);
  });

  it("keeps the last name of a removed folder it cannot place", () => {
    expect(repoNamer()(join(root, "elsewhere-gone"))).toBe("elsewhere-gone");
  });

  it("takes either separator, and an empty folder is no repo", () => {
    const name = repoNamer();
    expect(name(join(root, "repo-b", "web").replace(/\//g, "\\"))).toBe("repo-b");
    expect(name(join(root, "repo-b", "web").replace(/\\/g, "/"))).toBe("repo-b");
    expect(name("")).toBe(NO_REPO);
    expect(name(undefined)).toBe(NO_REPO);
  });
});
