// What /cornerman:stats costs on a large store (docs/no-bloat/PROJECT-PLAN.md, wave 3).
// Every store here is a temp folder made by the test.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ledgerLine } from "../../plugin/packages/store/relay-retention.mjs";
import { ledgerMonth, readRelayStats, relayStats } from "../../plugin/packages/store/relay-stats.mjs";

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 20, 12, 0, 0).getTime();
let seq = 0;
const win = (o = {}) => {
  const updatedAt = o.updatedAt ?? NOW - DAY;
  return { v: 1, key: `${(updatedAt - DAY).toString(36)}-${(seq++).toString(36)}`, cwd: "/work/repo-a", sessions: ["s1"], limit: 15, configured: 15, used: 1, stalled: 0, applied: 0, ...o, updatedAt };
};

let store, ledgerDir;
beforeEach(() => {
  store = mkdtempSync(join(tmpdir(), "cr-stats-cost-"));
  ledgerDir = join(store, "ledger");
  mkdirSync(ledgerDir);
});
afterEach(() => rmSync(store, { recursive: true, force: true }));

// Not a pass/fail gate on speed: the numbers go in the PR. The bound only catches a
// slip by an order of magnitude.
describe("cost on a large store", () => {
  it("aggregates 2,000 live windows and 12 months of 1,500 ledger lines", async () => {
    const repos = Array.from({ length: 40 }, (_, i) => `/work/repo-${i}`);
    const relayDir = join(store, "relay");
    mkdirSync(relayDir);
    const live = [];
    for (let i = 0; i < 2000; i++) {
      const w = win({ cwd: repos[i % repos.length], sessions: ["a", "b", "c"].slice(0, 1 + (i % 3)), used: i % 7, updatedAt: NOW - (i % 40) * DAY });
      live.push(w);
      writeFileSync(join(relayDir, `${w.key}.json`), JSON.stringify(w));
    }
    for (let m = 0; m < 12; m++) {
      const at = new Date(2026, 10 - m, 10, 12).getTime();
      const lines = Array.from({ length: 1500 }, (_, i) => ledgerLine(win({ cwd: repos[i % repos.length], used: i % 5, updatedAt: at + (i % 9) * 3_600_000 }), NOW) + "\n");
      writeFileSync(join(ledgerDir, `${ledgerMonth(at)}.jsonl`), lines.join(""));
    }
    const time = async (fn) => {
      const t = performance.now();
      const out = await fn();
      return [out, performance.now() - t];
    };
    const [all, full] = await time(() => readRelayStats({ store }));
    expect(all.size).toBeGreaterThanOrEqual(12);
    // The counting alone, with every file already in memory.
    const texts = readdirSync(ledgerDir).map((n) => readFileSync(join(ledgerDir, n), "utf8"));
    const [, counting] = await time(() => relayStats({ ledgers: texts, live }));
    const [, twoMonths] = await time(() => readRelayStats({ store, months: [ledgerMonth(NOW), "2026-10"] }));
    console.log(
      `relay stats cost: /cornerman:stats as run (2 ledger months + 2,000 live files read) ${twoMonths.toFixed(1)} ms; whole store read ${full.toFixed(1)} ms; ` +
        `counting alone (18,000 lines + 2,000 windows in memory) ${counting.toFixed(1)} ms`,
    );
    expect(full).toBeLessThan(5_000);
  });
});
