// save.mjs names each folder in one spelling. It used to print the same folder three ways in one run
// (backslashes, an 8.3 short name, the long name), which read as three places
// (docs/findings-polish-and-launch.md 1.3). These runs hand it a folder spelled another way and
// check that every line names it the long way, forward slashes, the same each time.
// tdd-guard:allow - written against the save.mjs change and checked to fail on the old save.mjs first.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GIT_TEST_TIMEOUT, removeTemp } from "./helpers/git-temp.mjs";

const save = fileURLToPath(new URL("../plugin/scripts/save.mjs", import.meta.url));
const fwd = (p) => p.replace(/\\/g, "/").replace(/^([a-z]):/, (_, d) => `${d.toUpperCase()}:`);

let base, home, repo;
beforeEach(() => {
  base = realpathSync.native(mkdtempSync(join(tmpdir(), "cr-save-out-")));
  home = join(base, "home");
  repo = join(base, "work", "widget-shop");
  mkdirSync(home, { recursive: true });
  mkdirSync(join(repo, "src"), { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: repo });
  execFileSync("git", ["-c", "user.email=t@x.invalid", "-c", "user.name=t", "commit", "--allow-empty", "-q", "-m", "init"], { cwd: repo });
});
afterEach(() => removeTemp(base));

function run(cwdArg, cwd) {
  const env = { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_CODE_SESSION_ID: "", CORNERMAN_AUTO: "", CORNERMAN_HEADLESS: "", CORNERMAN_WEB: "" };
  return execFileSync("node", [save, "--title", "Cart totals rounding", "--cwd", cwdArg], { cwd, input: "# T\n\n## Goal\ng\n", env, encoding: "utf8" });
}

// Every spelling of the fixture folder the output contains, up to and including "widget-shop".
const spellings = (out) => [...new Set([...out.matchAll(/(\S*widget-shop)/g)].map((m) => m[1]))];

// Another spelling of `repo`: a link to it (a junction on Windows, which needs no admin rights),
// with mixed slashes on Windows. longForm follows links the way it expands 8.3 names, so this is
// the same fault as a C:/Users/JOHNSM~1/... temp folder, on any machine.
function otherSpelling() {
  const link = join(base, "link-to-shop");
  symlinkSync(repo, link, process.platform === "win32" ? "junction" : "dir");
  if (process.platform !== "win32") return link;
  let n = 0;
  return link.replace(/\\/g, (m) => (n++ % 2 ? "/" : m));
}

describe("save.mjs output", () => {
  it("puts what happens after /clear straight after the save, ahead of the worktree line", () => {
    const tree = join(base, "work", "widget-shop-fix");
    execFileSync("git", ["worktree", "add", "-q", "-b", "fix/rounding", tree], { cwd: repo });
    const lines = run(tree, tree).trim().split("\n");
    expect(lines[0]).toMatch(/^Saved handover "Cart totals rounding" \(id [0-9a-f]+\)\.$/);
    expect(lines[1]).toBe(`After /clear, the next session in ${fwd(tree)} loads it automatically.`);
    expect(lines[2]).toBe(`It loads only in this worktree, not in ${fwd(repo)}.`);
    // The body has only a Goal, so the missing-sections note (#194) follows the details.
    expect(lines[3]).toMatch(/^Note: this handover has no /);
    expect(lines).toHaveLength(4);
  }, GIT_TEST_TIMEOUT);

  // #229: outside a repo the session root came back with backslashes and the main checkout with
  // forward slashes, so one folder read as two and the save denied the load it had just promised.
  it("says nothing about worktrees in a folder that is not a git repo", () => {
    const plain = join(base, "plain");
    mkdirSync(plain);
    const out = run(plain, plain);
    expect(out).toContain(`After /clear, the next session in ${fwd(plain)} loads it automatically.`);
    expect(out).not.toContain("loads only in this worktree");
  }, GIT_TEST_TIMEOUT);

  it("names the folder one way when it is handed in another spelling", () => {
    // From a subfolder, so the "Filed against" line names the folder too.
    const out = run(join(otherSpelling(), "src"), repo);
    expect(spellings(out)).toEqual([fwd(repo)]);
    expect(out).not.toMatch(/\\/);
    expect(out).toContain(`Filed against the session root ${fwd(repo)}/src, not the current directory.`);
  }, GIT_TEST_TIMEOUT);

  it("says nothing about the current directory when it is the session root in another spelling", () => {
    const out = run(otherSpelling(), repo);
    expect(out).not.toContain("Filed against");
    expect(spellings(out)).toEqual([fwd(repo)]);
  }, GIT_TEST_TIMEOUT);
});

// Field audit, 2026-11-28: 922 relative paths in 14 days of handovers did not open from the repo the
// handover was filed against. The save names each one, and where it really is, so the saving session
// can fix it while it still knows.
describe("save.mjs path note", () => {
  const saveBody = (body) => {
    const env = { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_CODE_SESSION_ID: "", CORNERMAN_AUTO: "", CORNERMAN_HEADLESS: "", CORNERMAN_WEB: "" };
    return execFileSync("node", [save, "--title", "Cart totals rounding", "--cwd", repo], { cwd: repo, input: body, env, encoding: "utf8" });
  };
  const sectionsFor = (next, readFirst) =>
    ["# T", "", "## Goal", "g", "", "## Next action", next, "", "## Read first", ...readFirst, "", "## State", "s", "", "## Open questions", "None.", ""].join("\n");

  it("names a path that opens only from the repo the handover names, and a read-first file found nowhere", () => {
    const orders = join(base, "work", "orders-app");
    mkdirSync(join(orders, "docs"), { recursive: true });
    execFileSync("git", ["init", "-q"], { cwd: orders });
    writeFileSync(join(orders, "docs", "plan.md"), "x");
    const out = saveBody(sectionsFor(`In ${fwd(orders)}, run the tests.`, ["- docs/plan.md - the plan", "- docs/gone/OLD.md - last week"]));
    const lines = out.trim().split("\n");
    const at = lines.indexOf(`Note: 2 paths in this handover do not open from ${fwd(repo)}:`);
    expect(at).toBeGreaterThan(-1);
    expect(lines.slice(at + 1, at + 4)).toEqual([
      `  - docs/plan.md is at ${fwd(orders)}/docs/plan.md`,
      "  - docs/gone/OLD.md (Read first) was not found",
      "Save again with the full paths, and drop or fix any not found.",
    ]);
  }, GIT_TEST_TIMEOUT);

  // The replay's worst handover had 17: the note stays short enough to read.
  it("lists at most 10 paths, then how many more", () => {
    const missing = Array.from({ length: 12 }, (_, i) => `- docs/gone/F${i}.md - old`);
    const out = saveBody(sectionsFor("Carry on.", missing));
    expect(out).toContain(`Note: 12 paths in this handover do not open from ${fwd(repo)}:`);
    expect(out.match(/^ {2}- docs\/gone\/F\d+\.md \(Read first\) was not found$/gm)).toHaveLength(10);
    expect(out).toContain("\n  +2 more\n");
  }, GIT_TEST_TIMEOUT);
});
