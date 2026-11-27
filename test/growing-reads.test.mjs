// Fix 12 (cornerman-eval stress test, development trial 5, seed 104, 2026-11-26): every handover's
// Read first list named docs/reading-notes.md, a notes file the work appends one line to per reading
// file, and the list grew to 8 files as each doc the session wrote was added. The start note tells
// the next session to open every Read first file, so each session re-read more: the first-turn
// context climbed from 22k to 58k, against a level 33k in trials 3 and 4 (no Read first list), and the
// last sessions handed over every few turns. Saving now names a Read first file that changed since
// the previous handover was saved: a record is fine to keep, work output belongs under Key files.
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { carryForward, growingReads } from "../plugin/scripts/lib/carry.mjs";

const top = mkdtempSync(join(tmpdir(), "cm-growing-"));
afterAll(() => rmSync(top, { recursive: true, force: true }));
mkdirSync(join(top, "docs"));
const PREV = new Date("2026-11-26T10:00:00Z");
const before = new Date("2026-11-26T09:00:00Z");
const after = new Date("2026-11-26T10:30:00Z");
const file = (rel, when) => {
  writeFileSync(join(top, rel), "x\n");
  utimesSync(join(top, rel), when, when);
};
file("docs/reading-notes.md", after); // appended this session (the trial's case)
file("docs/DECISIONS.md", before); // a record, untouched since the last handover
file("docs/export.md", after); // a doc this session wrote

const body = (readFirst, keyFiles = "None.") => `# Ledger reading batches

## Goal
Finish the reading batches.

## Next action
Read /reading/r0101-*.md and add a line per file to docs/reading-notes.md.

## Read first
${readFirst}

## Decided, not yet applied
None.

## Open questions
None.

## Key files
${keyFiles}
`;

describe("growingReads", () => {
  it("names the Read first files changed since the previous handover, not the untouched record", () => {
    const b = body(
      "- docs/reading-notes.md - one line per reading file, r0001 to r0100\n- `docs/DECISIONS.md` - rulings so far\n- docs/export.md - the CSV export doc",
    );
    expect(growingReads(b, { created: PREV.toISOString() }, top)).toEqual(["docs/reading-notes.md", "docs/export.md"]);
  });

  it("moved to Key files, the notes file is not carried back as a Read first item", () => {
    const prev = body("- docs/reading-notes.md - one line per reading file");
    const next = body("None.", "- docs/reading-notes.md - one line per reading file, appended each batch");
    const { carried } = carryForward(next, { title: "prev", body: prev });
    expect(carried.filter((c) => c.tag === "read first")).toEqual([]);
  });
});
