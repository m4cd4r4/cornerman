// Fault 6 of cornerman-eval stage A (2026-11-18): Claude Code replaces a SessionStart hook output
// over 10,000 characters with a 2KB preview and a file path ("Output too large"). cornerman sent
// the handover and the rulings log as one output of 10-14KB with the rules at the end, so the rules
// were the part cut: 21 of 24 loads in Test 1, 23 of 24 in stage A. Seed 7 never opened the file
// and scored 3 of 24. The cap is per hook output (rig/spike/captest.mjs, CLI 2.1.316), so the
// context now goes out as separate hook outputs, each held under a budget below the cap.
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { saveHandover } from "../plugin/scripts/lib/store.mjs";
import { rulingsSection } from "../plugin/scripts/lib/rulings.mjs";
import { BUDGET } from "../plugin/scripts/lib/start-parts.mjs";
import { removeTemp } from "./helpers/git-temp.mjs";

const ENTRY = resolve(import.meta.dirname, "..", "plugin", "scripts", "hook-entry.cjs");

let base, root, repo;
beforeEach(() => {
  base = realpathSync.native(mkdtempSync(join(tmpdir(), "cr-cap-")));
  root = join(base, "store");
  repo = join(base, "work", "bakery-orders");
  execFileSync("git", ["init", "-q", "-b", "main", repo]);
  execFileSync("git", ["-c", "user.email=t@x.invalid", "-c", "user.name=t", "commit", "--allow-empty", "-q", "-m", "init"], { cwd: repo });
});
afterEach(() => removeTemp(base));

const env = () => {
  const e = {};
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith("CORNERMAN_")) e[k] = v;
  return { ...e, CORNERMAN_HOME: root, CORNERMAN_SYNC: "off", CLAUDE_PID: "" };
};

// Both SessionStart commands of hooks/hooks.json, started together with the same input as Claude
// Code starts them. Returns every output's additionalContext.
function runHook(name, input) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [ENTRY, name], { cwd: repo, env: env(), stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("close", (code) => done({ code, out }));
    child.stdin.end(JSON.stringify(input));
  });
}
async function sessionStart(input = { session_id: "sess-new", cwd: repo, source: "clear" }) {
  const runs = await Promise.all([runHook("session-start", input), runHook("session-start-part", input)]);
  for (const r of runs) expect(r.code).toBe(0);
  return runs.filter((r) => r.out).map((r) => JSON.parse(r.out).hookSpecificOutput?.additionalContext ?? "");
}

// Neutral fixture (a bakery order app), sized like the stage A loads: 10-14KB.
const RULES = Array.from({ length: 20 }, (_, i) => `Bakery rule ${i + 1}: loaves on order ${i + 1} are always baked the night before pickup, never on the day.`);
const DONTS = Array.from({ length: 5 }, (_, i) => `Do not touch oven profile ${i + 1} without asking the head baker first.`);
const LOGGED = [
  ...Array.from({ length: 18 }, (_, i) => ({ at: "2026-11-18T10:00:00Z", text: `Never charge a delivery fee on orders over ${i + 40} dollars, that is a standing promise to regulars.` })),
  ...Array.from({ length: 10 }, (_, i) => ({ at: "2026-11-18T11:00:00Z", text: `Add a sourdough option number ${i + 1} to the order form and its tests in src/form-${i + 1}.js.` })),
];
const progress = Array.from({ length: 90 }, (_, i) => `- Step ${i + 1}: wired the pickup slot picker for shop ${i + 1} and checked the totals by hand.`).join("\n");
const body = (rules = RULES) =>
  `# Orders\n\n## Goal\nShip the order form.\n\n## Next action\nRun the tests in test/form.test.js.\n\n` +
  `## Progress\n${progress}\n\n## Read first\n- docs/decisions.md\n\n## Decided, not yet applied\n- Rename the pickup field to collect_at.\n\n` +
  `## Open questions\n- Does the Saturday shop open at 7 or 8?\n\n` +
  `## Decisions already made\n${rules.map((r) => `- ${r}`).join("\n")}\n\n## Do not\n${DONTS.map((r) => `- ${r}`).join("\n")}\n\n` +
  rulingsSection(LOGGED);

describe("fault 6: the session-start context arrives whole", () => {
  it("sends a 14,000-character handover as outputs each under the budget, with every standing rule in one", async () => {
    const b = body();
    expect(b.length).toBeGreaterThanOrEqual(12_000);
    expect(b.length).toBeLessThanOrEqual(15_000);
    saveHandover({ cwd: repo, title: "Order form", body: b, root, owner: "" });

    const outs = await sessionStart();

    expect(BUDGET).toBeLessThanOrEqual(9_500);
    expect(outs.length).toBe(2);
    for (const o of outs) expect(o.length).toBeLessThanOrEqual(BUDGET);
    const all = outs.join("\n");
    for (const r of [...RULES, ...DONTS, ...LOGGED.slice(0, 18).map((e) => e.text)]) expect(all).toContain(r);
    // The handover and its next action are in the main output; the rules block lists rules first.
    expect(outs[0]).toContain("Run the tests in test/form.test.js.");
    const rules = outs.find((o) => o.startsWith("cornerman: standing rules for handover"));
    expect(rules.indexOf(RULES[0])).toBeLessThan(rules.indexOf("Task requests"));
  });

  it("with the rules alone over the budget, says what was left out and where the full copy is", async () => {
    const many = Array.from({ length: 70 }, (_, i) => `Bakery rule ${i + 1}: the order slip for tray ${i + 1} is printed in the shop's own font, size twelve, never smaller.`);
    saveHandover({ cwd: repo, title: "Order form", body: body(many), root, owner: "" });

    const outs = await sessionStart();

    for (const o of outs) expect(o.length).toBeLessThanOrEqual(BUDGET);
    const rules = outs.find((o) => o.startsWith("cornerman: standing rules for handover"));
    // Task requests go first, then standing rules, and the block says so and where they are.
    expect(rules).not.toContain("Add a sourdough option");
    expect(rules).toMatch(/left out of this block .*: \d+ task requests, \d+ standing rules\./);
    expect(rules).toMatch(/The full handover is in \S*loaded[\\/]\S+\.md: open it and read what was left out before your first action\./);
    expect(rules).toContain(many[69]);
  });

  it("keeps a handover that fits as one output, and the second hook prints nothing and does not wait", async () => {
    saveHandover({ cwd: repo, title: "Small", body: "# S\n\n## Next action\nRun it.\n\n## Do not\n- Never push to main.\n", root, owner: "" });
    const t = Date.now();

    const outs = await sessionStart();

    expect(outs).toHaveLength(1);
    expect(outs[0]).toContain("Never push to main.");
    expect(Date.now() - t).toBeLessThan(5_000);
  });
});
