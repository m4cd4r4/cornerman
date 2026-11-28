// The load notice names handover paths that do not open from the folder the handover is filed
// against, with where each file really is (lib/paths.mjs). Field audit, 2026-11-28: 922 relative
// paths in 14 days of handovers did not open from the handover's repo; the next session opened what
// it was given, found nothing, and guessed or carried on without the file.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadedParts } from "../plugin/scripts/lib/load-context.mjs";
import { GIT_TEST_TIMEOUT, removeTemp } from "./helpers/git-temp.mjs";

const fwd = (p) => p.replace(/\\/g, "/").replace(/^([a-z]):/, (_, d) => `${d.toUpperCase()}:`);
let base;
const repo = (name) => {
  const dir = join(base, name);
  mkdirSync(join(dir, "docs"), { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: dir });
  return dir;
};
beforeEach(() => {
  base = realpathSync.native(mkdtempSync(join(tmpdir(), "cr-load-ctx-")));
});
afterEach(() => removeTemp(base));

const parts = (body, top) =>
  loadedParts({ root: join(base, "store"), load: { id: "a1b2c3", meta: { title: "Cart totals", created: new Date().toISOString(), repo: top }, body }, top, branch: "", now: Date.now() });

describe("loadedParts path line", () => {
  it("tells the next session where each path that does not open from the repo really is", () => {
    const shop = repo("widget-shop");
    const orders = repo("orders-app");
    writeFileSync(join(orders, "docs", "plan.md"), "x");
    const body = `# Cart totals\n\n## Next action\nIn ${fwd(orders)}, run the tests.\n\n## Read first\n- docs/plan.md - the plan\n- docs/gone/OLD.md - last week\n`;
    const line = parts(body, shop).context.find((c) => c.includes("do not open from"));
    expect(line).toBe(
      `cornerman: 2 paths in this handover do not open from ${fwd(shop)}. Use these instead:\n` +
        `- docs/plan.md: open ${fwd(orders)}/docs/plan.md\n` +
        `- docs/gone/OLD.md (Read first): not found anywhere; tell the user rather than guess what it held`,
    );
  }, GIT_TEST_TIMEOUT);
});
