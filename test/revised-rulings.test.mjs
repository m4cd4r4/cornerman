// Fix 13 (cornerman-eval stress test, development trial 6, seed 105, 2026-11-26): the session listed
// "1. all lower case, 2. all upper case" and the user picked "the second one". Handover 5 recorded upper
// case, which was right. Handover 6 rewrote it: "standardised on all LOWER case ... The previous handover
// wrongly said upper case; corrected here", taking the order from the user's request instead of the
// session's own list, and with no new user message. Every later handover kept the wrong value and the
// probe built lower case. Saving now names a Decisions line that says it corrects an earlier handover,
// next to the earlier handover's version, so the writer changes a carried ruling only on the user's word.
import { describe, expect, it } from "vitest";
import { revisedRulings } from "../plugin/scripts/lib/carry.mjs";

const body = (decisions) => `# Ledger reading batches

## Goal
Finish the reading batches.

## Next action
Read /reading/r0101-*.md.

## Read first
None.

## Decisions already made
${decisions}

## Do not
- Do not touch src/legacy/.

## Open questions
None.
`;

const prev = {
  title: "batch 5",
  body: body(
    '- Account ids are standardised on all upper case (user: "Go with the second one. Nothing to build yet"). Nothing built.\n- Persist with csv.',
  ),
};

describe("revisedRulings", () => {
  it("names a Decisions line that corrects the previous handover, with the previous version beside it", () => {
    const next = body(
      '- Account ids are standardised on all LOWER case (user: "Go with the second one" on the list 1. upper, 2. lower). The previous handover wrongly said upper case; corrected here. Nothing built.\n- Persist with csv.',
    );
    const out = revisedRulings(next, prev);
    expect(out).toHaveLength(1);
    expect(out[0].text).toMatch(/LOWER case/);
    expect(out[0].was).toMatch(/all upper case/);
  });

  it("names the line under Decided, not yet applied too, where trial 6's handover wrote it", () => {
    const decided = (d) => body(d).replace("## Decisions already made", "## Decided, not yet applied");
    const before = { body: decided('- Account ids are standardised on all upper case (user: "Go with the second one"). Nothing built.') };
    const next = decided("- Account ids are standardised on all LOWER case. The previous handover wrongly said upper case; corrected here. Nothing built.");
    const out = revisedRulings(next, before);
    expect(out).toHaveLength(1);
    expect(out[0].was).toMatch(/all upper case/);
  });

  it("says nothing when a ruling is reworded without claiming a correction", () => {
    const next = body("- Account ids: all upper case, the user's pick; the last handover's wording was long. Nothing built.\n- Persist with csv.");
    expect(revisedRulings(next, prev)).toEqual([]);
  });
});
