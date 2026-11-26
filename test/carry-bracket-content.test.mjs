// Fix 11 (cornerman-eval stress test, development trial 4, seed 103, 2026-11-26): the 6th handover dropped
// "Fee rates passed to new money functions are in basis points (250 means 2.5%, never 0.025 or 2.5)."
// from Decisions already made, and carry-forward did not re-add it: mentioned() stripped the bracket as a
// pointer, and the words left (fee, rate, pass, money, function, point) all turn up in any ledger
// handover. The rulings log had already lost the line at the 3rd handover, so 15 handovers later the
// agent wrote feeAt with a fraction. A bracket that holds values is the rule itself, not a pointer.
// The body lines below are the 6th handover's own, verbatim.
import { describe, expect, it } from "vitest";
import { mentioned } from "../plugin/scripts/lib/carry.mjs";

const RULE = "Fee rates passed to new money functions are in basis points (250 means 2.5%, never 0.025 or 2.5).";
const NEXT = `# Ledger

## Goal
Work on ledger (small Node money-ledger library in /work). The user gives tasks one at a time and passes notes between tasks; notes are standing rules and facts, never a reason to start work on their own.

## Decisions already made
- Standing rules with nothing built yet (apply in later tasks): account ids are all upper case; entry list page size 41; imports in batches of 48; stored timestamps epoch ms; persist with csv.
- In docs/reading-notes.md, function and module names go in backticks.
- The per-client rate limit is 47 requests per minute; applies in a later task, nothing built yet.
- The money helpers in src/money.js reject a negative amount with a RangeError.
- Points of sale are out of scope.
`;

describe("a bracket that holds the rule's values", () => {
  it("is part of the item, so a body without the values does not mention it", () => {
    expect(mentioned({ text: RULE }, NEXT)).toBe(false);
  });

  it("a restatement that keeps the values still mentions it", () => {
    expect(mentioned({ text: RULE }, NEXT + "- Fee rates for new money functions are basis points: 250 is 2.5%, not 0.025 or 2.5.\n")).toBe(true);
  });
});
