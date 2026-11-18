// Seed 7 of the cornerman-eval Test 1 batch (2026-11-17), replayed through save.mjs. The third
// handover was written for a narrow reading task: its "Decisions already made" held only the
// commit-message rules, so the fourth session had the 24 standing facts only through the rulings
// log. That log (a) trimmed rules to stay short ("23 calls a minute" was gone), (b) framed every
// entry as "may be requests already done" and (c) kept MIT, 2 spaces and single quotes unmarked next
// to their corrections. cm missed 21 of 24. Each test below is one of the fixes for that chain.
// Fixture: test/fixtures/seed7-chain (README there).
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { archive, listWaiting } from "../plugin/scripts/lib/store.mjs";
import { sections } from "../plugin/scripts/lib/carry.mjs";
import { GIT_TEST_TIMEOUT, removeTemp } from "./helpers/git-temp.mjs";

const SCRIPTS = fileURLToPath(new URL("../plugin/scripts/", import.meta.url));
const FIX = fileURLToPath(new URL("./fixtures/seed7-chain/", import.meta.url));
const TITLES = [
  "ledger: npm-notes batch 2 (3 of 6 files read)",
  "ledger: npm-notes batches 2-4 done, awaiting next batch",
  "ledger: npm-notes batches 5-8 done, awaiting next batch",
];
const WINDOW = "999991"; // one window, cleared in turn (a dead pid is used bare)

let base, root, repo, final;
beforeAll(() => {
  base = realpathSync.native(mkdtempSync(join(tmpdir(), "cr-seed7-")));
  root = join(base, "store");
  repo = join(base, "work", "ledger");
  mkdirSync(repo, { recursive: true });
  mkdirSync(join(root, "rulings"), { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: repo });
  execFileSync("git", ["-c", "user.email=t@x.invalid", "-c", "user.name=t", "commit", "--allow-empty", "-q", "-m", "init"], { cwd: repo });
  for (const n of [1, 2, 3]) {
    if (n > 1) {
      // The SessionStart hook loads the waiting handover into the cleared session.
      const prev = listWaiting(root, repo).find((h) => h.meta.title === TITLES[n - 2]);
      archive(root, null, prev.path, { via: "hook", owner: WINDOW });
    }
    copyFileSync(join(FIX, `s${n}.jsonl`), join(root, "rulings", `s${n}.jsonl`));
    execFileSync(process.execPath, [join(SCRIPTS, "save.mjs"), "--title", TITLES[n - 1], "--cwd", repo], {
      cwd: repo,
      input: readFileSync(join(FIX, `h${n}.md`), "utf8"),
      env: { ...process.env, CORNERMAN_HOME: root, CORNERMAN_SYNC: "off", CORNERMAN_AUTO: "", CORNERMAN_HEADLESS: "", CORNERMAN_WEB: "", CORNERMAN_TRAIL: "0", CLAUDE_CODE_SESSION_ID: `s${n}`, CLAUDE_PID: WINDOW },
      encoding: "utf8",
    });
  }
  // What the fourth session loaded.
  final = listWaiting(root, repo).find((h) => h.meta.title === TITLES[2]).body;
}, GIT_TEST_TIMEOUT * 3);
afterAll(() => removeTemp(base));

const section = (heading) => {
  const s = sections(final).find((x) => x.heading.startsWith(heading));
  return s ? s.lines.join("\n") : "";
};
const rulingLine = (needle) => section("Rulings from the user").split("\n").find((l) => l.startsWith("- ") && l.includes(needle));

// Every standing rule and fact the user gave in session 1, by a phrase of its own words.
const STANDING = [
  "fractions of a cent always round down",
  "ledger storage goes in JSON lines",
  "Stay out of src/legacy/compat.js",
  "2 spaces for indentation",
  "Ask me before changing the delimiter",
  "Step 4, the index rebuild",
  "App config: conf/app.json",
  "23 calls a minute per client",
  "throw a TypeError",
  "ISO 8601 strings",
  "Don't edit the existing tests",
  "single quotes for strings",
  "which entries monthlyTotal() counts",
  "Step 4, tagging the release",
  "rates/live.json",
  "Import batch size is 120 entries",
  "comma thousands separator",
  "Account ids are always lower case",
  "Don't change src/ledger.js",
  "SPDX-License-Identifier: MIT",
  "how loadConfig finds the config file",
  "Step 5, deleting the originals",
  "templates/email/invoice.txt",
  "15 entries per page",
  "Actually make that 3 spaces",
  "switch to double quotes",
  "SPDX-License-Identifier: ISC",
];

describe("seed 7: the final session's context", () => {
  it("fix 1: the rulings log keeps every standing rule, and trims only task requests", () => {
    const missing = STANDING.filter((s) => !rulingLine(s));
    expect(missing).toEqual([]);
    expect(section("Rulings from the user")).not.toMatch(/standing rules? left out/i);
  });

  it("fix 2: a ruling the user later corrected is marked as replaced; the correction is not", () => {
    for (const old of ["2 spaces for indentation", "single quotes for strings", "SPDX-License-Identifier: MIT"])
      expect(rulingLine(old)).toMatch(/\(replaced by a later one\)\s*$/);
    for (const now of ["Actually make that 3 spaces", "switch to double quotes", "SPDX-License-Identifier: ISC", "23 calls a minute"])
      expect(rulingLine(now)).not.toMatch(/replaced/);
  });

  it("fix 3: the log is framed as standing rules unless replaced, and requests are listed apart", () => {
    const text = section("Rulings from the user");
    expect(text).not.toMatch(/may be requests already done/i);
    expect(text).toMatch(/holds for all later work unless a later one replaces it/i);
    const lines = text.split("\n");
    const requests = lines.findIndex((l) => /^Task requests/.test(l));
    expect(lines.findIndex((l) => l.includes("23 calls a minute"))).toBeLessThan(requests);
    expect(lines.findIndex((l) => l.includes("Next batch of reading"))).toBeGreaterThan(requests);
  });
});
