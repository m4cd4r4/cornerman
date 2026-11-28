// Paths in a handover that do not open from the folder it is filed against. Field audit,
// 2026-11-28, 14 days of real handovers: 922 relative paths in Next action, Read first and Key
// files did not open from the handover's repo, most because the handover was filed under the
// session root (the home folder, another project) while its paths belong to the repo the work
// was in. 513 of them opened from another checkout or a repo the handover names.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pathProblems, pathsIn } from "../plugin/scripts/lib/paths.mjs";
import { GIT_TEST_TIMEOUT, removeTemp } from "./helpers/git-temp.mjs";

let base;
const fwd = (p) => p.replace(/\\/g, "/");
const repo = (name) => {
  const dir = join(base, name);
  mkdirSync(dir, { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["-c", "user.email=t@x.invalid", "-c", "user.name=t", "commit", "--allow-empty", "-q", "-m", "init"], { cwd: dir });
  return dir;
};
const file = (dir, rel) => {
  mkdirSync(join(dir, rel, ".."), { recursive: true });
  writeFileSync(join(dir, rel), "x");
};
beforeEach(() => {
  base = realpathSync.native(mkdtempSync(join(tmpdir(), "cr-paths-")));
});
afterEach(() => removeTemp(base));

// CI, 2026-11-28: on Linux and macOS no absolute path was seen at all, so the repo a handover named
// was never searched and every check passed silently. A slash command is never a path.
describe("pathsIn", () => {
  it("reads a POSIX absolute path on Linux and macOS, never a slash command, and not on Windows", () => {
    const text = "In /home/pat/orders-app, run the tests. Then /clear, and see /relay off.";
    expect(pathsIn(text, "linux").abs).toEqual(["/home/pat/orders-app"]);
    expect(pathsIn(text, "win32").abs).toEqual([]);
  });
});

describe("pathProblems", () => {
  it("finds a relative path in the repo the handover names, when it does not open from where it is filed", () => {
    const home = repo("home");
    const orders = repo("orders-app");
    file(orders, "docs/plan.md");
    const body = `# T\n\n## Next action\nIn ${fwd(orders)}, run the tests.\n\n## Read first\n- docs/plan.md - the rye rows\n`;
    expect(pathProblems(body, home).map((p) => ({ path: p.path, found: fwd(p.found) }))).toEqual([{ path: "docs/plan.md", found: `${fwd(orders)}/docs/plan.md` }]);
  }, GIT_TEST_TIMEOUT);

  // 7 of the audit's 8 wrong-checkout paths: a plan named in the main checkout, written in a worktree.
  it("finds an absolute path named in the main checkout that exists only in a worktree", () => {
    const main = repo("bakery");
    const wt = join(base, "bakery-rye-plan");
    execFileSync("git", ["worktree", "add", "-q", "-b", "rye", wt], { cwd: main });
    file(wt, "docs/rye/PLAN.md");
    const body = `# T\n\n## Read first\n- ${fwd(main)}/docs/rye/PLAN.md - the plan\n`;
    expect(pathProblems(body, main).map((p) => fwd(p.found))).toEqual([`${fwd(realpathSync.native(wt))}/docs/rye/PLAN.md`]);
  }, GIT_TEST_TIMEOUT);

  it("says nothing of a file still to be written or one that opens, and lists a missing read-first file", () => {
    const shop = repo("shop");
    file(shop, "src/oven.ts");
    const body = [
      "# T",
      "",
      "## Next action",
      "Create docs/rye/NOTES.md, then edit src/oven.ts. See https://example.com/docs/a.md and \\\\server\\share\\x.md.",
      "",
      "## Read first",
      "- src/oven.ts - the timer",
      "- docs/gone/OLD.md - last week's notes",
      "- EVAL/stress/driver.mjs - a folder the handover named EVAL",
    ].join("\n");
    expect(pathProblems(body, shop)).toEqual([{ section: "Read first", path: "docs/gone/OLD.md", found: "" }]);
  }, GIT_TEST_TIMEOUT);
});
