// What a loaded handover puts in front of Claude and the user: the context block,
// the one line the user sees, the note about what the old session left on screen
// and the readable copy. Shared by the SessionStart hook and the first-prompt
// second chance (second-chance.mjs), so a handover reads the same either way.
import { join } from "node:path";
import { writeLoadedCopy } from "../../packages/store/loaded.mjs";
import { captureDir, readCapture, summary } from "../../packages/store/artifacts.mjs";
import { age } from "./select.mjs";
import { tildePath } from "./display.mjs";
import { handoverId } from "./web.mjs";

// A handover's title and branch are whatever the repo says, so control characters
// are flattened: a newline in a title could otherwise forge a command line under it.
// Format characters go too (a U+202E override reverses what the user reads), and so
// do U+0085, U+2028 and U+2029, which some readers treat as line breaks (security
// review 2, 2026-09-27).
export const clean = (s, max = 120) => {
  const chars = [...String(s ?? "").replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, " ").replace(/\s+/g, " ").trim()];
  return chars.length > max ? `${chars.slice(0, max - 3).join("")}...` : chars.join("");
};

/** The line Claude's first reply opens with after a load. One line, whatever the title holds. */
export const OPENER = (title) => `Resuming handover "${clean(title)}".`;

/**
 * The note about what the loaded handover's session left on screen, as { context, shown }, or null.
 * Counts and a few titles only: the text stays on disk and is read when the user asks for it, so a
 * resumed session stays light. Best effort, like the copy.
 */
function artifactsNote(root, load) {
  try {
    const cap = readCapture(root, load.meta.sessionId);
    const what = cap && summary(cap.counts);
    if (!what) return null;
    const file = tildePath(join(captureDir(root, cap.sessionId), "artifacts.md"));
    const titles = cap.items.filter((i) => i.kind === "table" || i.kind === "list").slice(0, 4).map((i) => `"${clean(i.title, 60)}"`);
    return {
      context:
        `cornerman: the session that wrote this handover left ${what} on screen, kept verbatim in ${file}` +
        (titles.length ? ` (${titles.join(", ")})` : "") +
        `. Read that file only if the user asks about a list, table or link from before the clear.`,
      shown: `Earlier session left ${what}: ${file}`,
    };
  } catch {
    return null;
  }
}

/**
 * Write the readable copy of a loaded handover and return the line that names it,
 * or "" when there is no copy.
 *
 * After /clear the loaded handover is in Claude's context and nowhere the user can
 * open, so the load message names a plain markdown copy to read, copy, or
 * @-mention in another session. Best effort: a copy that cannot be written is
 * skipped, and the load goes on without the line.
 *
 * The path is printed relative to "~", as every path this plugin prints is, so it
 * carries no user name. The twin invocation rewrites the same file, dated by the
 * first one's load.
 */
function copyLine(root, load, top, loadedAt, sessionId) {
  try {
    const copy = writeLoadedCopy(
      root,
      {
        id: load.id ?? handoverId(load.meta),
        title: load.meta.title,
        // A copy carried in git names a repo path from wherever it was written.
        repoPath: load.source === "worktree" ? top : load.meta.repo || top,
        branch: load.meta.branch,
        createdAt: load.meta.created,
        body: load.body,
        loadedBy: sessionId,
      },
      { loadedAt },
    );
    return copy ? `A copy to read or share: ${tildePath(copy)}` : "";
  } catch {
    return "";
  }
}

/**
 * The parts of the output a loaded handover contributes: `context` blocks for
 * Claude, the `shown` line for the user, and the `assets` and `copy` lines that go
 * last in what the user sees.
 */
export function loadedParts({ root, load, top, branch, now, loadedAt = now, sessionId }) {
  const copy = copyLine(root, load, top, loadedAt, sessionId);
  // A branch mismatch is the one thing about a loaded handover the user should
  // notice, so it goes in both strings rather than only in Claude's copy.
  const from = load.meta.branch && load.meta.branch !== branch ? `, written on branch ${load.meta.branch}` : "";
  // The systemMessage is the only line the user sees, and Claude Code draws it, not
  // us. A fresh-user test (2026-09-28, Linux, tmux) found it missing from the screen
  // after /clear in 3 of 3 tries, visible only under ctrl+o, although the model had
  // the handover. So Claude is also asked to name the handover in its first reply.
  // That is a request, not a guarantee: in testing Claude skipped it 3 times in 9,
  // so nothing user-facing may promise the line.
  const context = [
    `cornerman: this session continues earlier work. Handover "${load.meta.title}", saved ${age(load.meta.created, now)}${from}. ` +
      `Its branch, file and status claims are a snapshot: check them before acting. ` +
      // #194: the next action is one item, not the whole job. Files kept across
      // sessions hold rulings and known mistakes the body only points at.
      `Before your first action, open every file listed under its "Read first" heading (a pointer you do not open carries nothing), ` +
      `and treat every item under "Decided, not yet applied", "Open questions" and "Carried forward" as open work, not background. ` +
      `The user may not have seen the load notice, so open your first reply with this one line, then carry on: ` +
      `${OPENER(load.meta.title)}\n\n${load.body.trim()}`,
  ];
  const shown = `cornerman: loaded handover "${load.meta.title}" (saved ${age(load.meta.created, now)}${from}).`;
  const note = artifactsNote(root, load);
  if (note) context.push(note.context);
  return { context, shown, assets: note?.shown ?? "", copy };
}
