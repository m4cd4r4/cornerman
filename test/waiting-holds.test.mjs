// Fix 10 (cornerman-eval stress test, development trial 3, seed 102, 2026-11-20): two handover lines
// that wait on the user. (1) Fix 9 moved a job's stop into State, but handover #5 also kept it under
// Do not ("do not write step 4 until told to carry on"), and every later writer restated it, 12 of 17
// handovers. (2) The agent asked what "Actually make that 3 spaces." meant, got no answer, and five
// handovers held "Do not change any indentation rule until answered" under Open questions; the next
// session wrote src/tags.js with 2 spaces. Saving now names such lines, and carry-forward no longer
// re-adds one as a standing [do not]. The lines below are the trial's own, verbatim.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { carryForward, waitingHolds } from "../plugin/scripts/lib/carry.mjs";

const STOP_LINE =
  "Do not commit scripts/migrate.mjs or scripts/release.mjs unless asked, and do not write step 4 in either until told to carry on.";
const QUESTION_LINE =
  '"Actually make that 3 spaces." (user, after the British spelling rule): unclear what "that" refers to; I asked whether it means the 2-space indentation for new files, no answer yet. Do not change any indentation rule until answered.';

const body = (doNot, question = "None.") => `# Ledger scripts

## Goal
Finish the ledger scripts.

## Next action
Wait for the next task.

## Read first
None.

## State
- scripts/migrate.mjs: step 3 written, uncommitted, stopped there as asked; step 4 is next only when the user says to carry on.

## Decided, not yet applied
None.

## Open questions
- ${question}

## Decisions already made
- New files: 2-space indentation, double quotes, first line \`// SPDX-License-Identifier: MIT\`.

## Do not
- ${doNot}
- Leave the step 2 stub in scripts/migrate.mjs exactly as it is: the user ran it by hand.
`;

describe("waitingHolds", () => {
  it("names a job's stop under Do not and a hold inside an open question", () => {
    expect(waitingHolds(body(STOP_LINE, QUESTION_LINE))).toEqual([
      { section: "Open questions", text: QUESTION_LINE },
      { section: "Do not", text: STOP_LINE },
    ]);
  });

  it("leaves standing rules, State lines, plain open questions and carried lines alone", () => {
    const plain = body("Do not commit scripts/migrate.mjs unless asked.", "Four-option button page shown, no answer recorded (review/buttons.html)");
    expect(waitingHolds(plain)).toEqual([]);
    const carried = `${plain}\n## Carried forward from the previous handover\nOpen in the previous handover and not mentioned in this one.\n- [do not] ${STOP_LINE}\n`;
    expect(waitingHolds(carried)).toEqual([]);
  });

  // The same trial's 17 handovers all held this user rule under Decisions; a first draft of fix 10
  // matched "until the user says" and would have moved it to State. A condition the user named
  // ("signed off") is the user's own rule, not a wait the agent made.
  it("leaves a rule whose condition the user named, in the trial's own wording", () => {
    const frozen = "src/ledger.js is frozen for the 1.0 API review: no edits until the user says it is signed off.";
    const withFrozen = body("Do not push to main.").replace(
      "## Decisions already made\n",
      `## Decisions already made\n- ${frozen}\n- Do not deploy until told otherwise.\n`,
    );
    expect(waitingHolds(withFrozen)).toEqual([]);
    const { carried } = carryForward(body("Do not push to main."), { title: "t", body: withFrozen });
    expect(carried.find((it) => it.text === frozen)?.tag).toBe("rule");
  });
});

describe("carryForward and a stop", () => {
  it("re-adds a dropped stop as a [stop] to put under State, never as a standing [do not]", () => {
    const { body: out, carried } = carryForward(body("Do not push to main."), { title: "Ledger scripts", body: body(STOP_LINE) });
    expect(carried.find((it) => it.text === STOP_LINE)?.tag).toBe("stop");
    expect(out).toContain(`- [stop] ${STOP_LINE}`);
    expect(out).toMatch(/A \[stop\] is where the user paused a job: put it under State/);
  });
});

describe("save.mjs", () => {
  it("prints a note naming each line that waits on the user", () => {
    const root = mkdtempSync(join(tmpdir(), "cm-holds-"));
    const repo = mkdtempSync(join(tmpdir(), "cm-holds-repo-"));
    try {
      execFileSync("git", ["init", "-q", "-b", "main"], { cwd: repo });
      const out = execFileSync(process.execPath, [join(import.meta.dirname, "../plugin/scripts/save.mjs"), "--title", "t", "--cwd", repo], {
        cwd: repo,
        input: body(STOP_LINE, QUESTION_LINE),
        env: { ...process.env, CORNERMAN_HOME: root, CORNERMAN_TRAIL: "0", CORNERMAN_RULINGS: "0" },
        encoding: "utf8",
      });
      expect(out).toContain("Note: 2 lines wait on the user:");
      expect(out).toContain(`  - [Do not] ${STOP_LINE}`);
      expect(out).toContain(`  - [Open questions] ${QUESTION_LINE}`);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
