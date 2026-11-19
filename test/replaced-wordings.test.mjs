// Fault 8 of cornerman-eval stage A (2026-11-18): the rulings log marked "Use 2 spaces" replaced
// after "Actually make that 3 spaces", but left the old indent rule unmarked in 5 of 8 trials where
// the correction was worded another way. The pairs below are the reversed facts and their late
// corrections exactly as the rig plants them (test1/facts.mjs on research/quality-1m), each between
// other plants from the same file, as one prompt per turn.
import { describe, expect, it } from "vitest";
import { markReplaced } from "../plugin/scripts/lib/rulings.mjs";

const REVERSED = [
  ["For new code in this repo, indent with tabs.", "Scratch that, use 2 spaces for indentation."],
  ["New files: 2-space indentation please.", "Actually I've changed my mind, tabs for indentation after all."],
  ["Indent with tabs in new files.", "Correction: 3 spaces per indent level, not tabs."],
  ["Use 3-space indents for new code.", "Never mind that, tabs it is."],
  ["Use 2 spaces for indentation in new files.", "Actually make that 3 spaces."],
  ["New code: 3 spaces per indent.", "Revised: 2 spaces per indent level."],
  ["Use single quotes for strings in new code.", "Actually, switch to double quotes for strings in new code."],
  ["Every new file starts with a licence line: `// SPDX-License-Identifier: MIT`.", "Correction on the licence line for new files: `// SPDX-License-Identifier: Apache-2.0`, not MIT."],
  ["Every new file starts with a licence line: `// SPDX-License-Identifier: Apache-2.0`.", "Correction on the licence line for new files: `// SPDX-License-Identifier: MIT`, not Apache-2.0."],
  ["Every new file starts with a licence line: `// SPDX-License-Identifier: MIT`.", "Correction on the licence line for new files: `// SPDX-License-Identifier: ISC`, not MIT."],
];
// Other plants of the same seed, which no correction replaces.
const OTHERS = [
  "Rule for new money functions: fractions of a cent always round down, never to nearest.",
  "Fee rates passed to new money functions are in basis points, so 250 means 2.5%, never 0.025 or 2.5.",
  "Whenever we show a total to a person: digits with a comma thousands separator and exactly two decimals, no currency symbol.",
  "The exchange-rate table the service actually reads is rates/live.json.",
  "The money helpers in src/money.js reject a negative amount with a RangeError rather than carrying on.",
];

describe("fault 8: every replaced ruling is marked, whatever the correction's wording", () => {
  it.each(REVERSED)("%s -> %s", (early, late) => {
    const texts = [OTHERS[0], early, OTHERS[1], OTHERS[2], OTHERS[3], late, OTHERS[4]];
    const out = markReplaced(texts.map((text) => ({ at: "", text })));
    expect(out.filter((e) => e.replaced).map((e) => e.text)).toEqual([early]);
    expect(out.find((e) => e.text === early).replaced).toBe("whole");
  });

  // Reviewer, 2026-11-19: a live rule marked replaced is dropped before live ones, the worst way round.
  it.each([
    ["Use 2-space indents.", "Actually, don't open extra browser tabs."],
    ["Use 2-space indents.", "Never mind, the tab bar can stay."],
    ["Use 2 spaces for indentation.", "I've changed my mind about the tab key shortcut in the editor docs."],
    ["Always run the failing tests before a commit.", "Never mind the failing tests on the legacy folder, carry on with the parser."],
    ["Never use yarn.", "Revised the yarn lockfile, please review."],
    ["Use 2-space indents.", "Actually, use tabs in the browser for the docs."],
  ])("does not mark %s after %s", (rule, later) => {
    const out = markReplaced([rule, OTHERS[0], later].map((text) => ({ at: "", text })));
    expect(out.filter((e) => e.replaced).map((e) => e.text)).toEqual([]);
  });

  // Second review, 2026-11-19: f86a4f9 counted a tab as indentation only in three set phrases,
  // so these corrections, each probed, left the old indent rule live.
  it.each(["Switch to tabs.", "Actually make that tabs.", "Make that tabs.", "Change that to tabs.", "Actually, tabs, not spaces.", "Actually tabs please.", "Never mind. Use tabs for indentation.", "Never mind the indent rule, use 4 spaces."])(
    "marks Use 2-space indents. after %s",
    (later) => {
      const out = markReplaced(["Use 2-space indents.", OTHERS[0], later].map((text) => ({ at: "", text })));
      expect(out.filter((e) => e.replaced).map((e) => e.text)).toEqual(["Use 2-space indents."]);
    },
  );
});
