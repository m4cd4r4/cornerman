// The first prompt of a session gets a second chance at this window's own handover
// (issue #204).
//
// A /clear here fires 18-34 SessionStart hooks at once. Between 29 Oct and 12 Nov
// 2026, 15 of 289 clears had cornerman's hook cancelled at its timeout: nothing
// loaded, nothing said so, and the VS Code auto-resume then told Claude to
// "Continue from the cornerman handover that was just loaded." The handover was
// still waiting, because the hook archives only after its output is written (#162).
//
// So on the first UserPromptSubmit of a session, unless SessionStart marked the
// session as delivered, this loads the window's OWN fresh waiting handover and
// nothing else: never another window's, never one picked by the branch rule. That
// is the handover the user just wrote, and a cancelled hook must not lose it.
import { closeSync, existsSync, mkdirSync, openSync, readSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { archive, listWaiting, repoInfo, repoKey, storeRoot } from "./store.mjs";
import { chooseHandover } from "./select.mjs";
import { ownerId } from "./owner.mjs";
import { markConsumed } from "./web.mjs";
import { loadedParts } from "./load-context.mjs";

// Machine-local, one empty file per session, ignored by the store sync (sync.mjs).
const startedDir = (root) => join(root, ".cache", "started");
const safeId = (id) => String(id ?? "").replace(/[^A-Za-z0-9_-]/g, "");

/** Mark a session as handled: its SessionStart delivered, or its first prompt was checked. */
export function markStarted(root, sessionId) {
  const id = safeId(sessionId);
  if (!id) return;
  try {
    mkdirSync(startedDir(root), { recursive: true });
    writeFileSync(join(startedDir(root), id), "");
  } catch {
    // Best effort: an unmarked session only costs one more check on its next prompt.
  }
}
markStarted.path = (root, sessionId) => join(startedDir(root), safeId(sessionId));

export const isStarted = (root, sessionId) => {
  const id = safeId(sessionId);
  return !id || existsSync(join(startedDir(root), id));
};

// The head of the transcript is enough: a session that already has a reply is a
// resumed or running one, and a handover loaded into it would land mid-task.
const HEAD_BYTES = 256 * 1024;

function hasReply(transcriptPath) {
  if (!transcriptPath) return false;
  let fd;
  try {
    fd = openSync(transcriptPath, "r");
    const buf = Buffer.alloc(HEAD_BYTES);
    const n = readSync(fd, buf, 0, HEAD_BYTES, 0);
    return buf.subarray(0, n).toString("utf8").includes('"type":"assistant"');
  } catch {
    return false;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** The UserPromptSubmit output that loads this window's own handover, or null. Never throws. */
export function run(input, { env = process.env, now = new Date(), me } = {}) {
  try {
    const root = storeRoot(env);
    const sessionId = input.session_id;
    if (isStarted(root, sessionId)) return null;
    // Only the first prompt is checked, whatever happens next.
    markStarted(root, sessionId);
    if (hasReply(input.transcript_path)) return null;

    const cwd = input.cwd || process.cwd();
    const { top, branch } = repoInfo(cwd);
    const key = repoKey(top);
    const waiting = listWaiting(root, key);
    if (!waiting.some((h) => h.meta.owner)) return null;
    const maxAgeDays = Number(env.CORNERMAN_MAX_AGE_DAYS) || 7;
    const owner = me ?? ownerId(env);
    const { load } = chooseHandover(waiting, branch, { now, maxAgeDays, owner, ownOnly: true });
    if (!load) return null;

    const p = loadedParts({ root, load, top, branch, now, sessionId });
    const shown = [p.shown, p.assets, p.copy].filter(Boolean).join("\n");
    const out = {
      systemMessage: shown,
      hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: p.context.join("\n\n---\n\n") },
    };
    // As at SessionStart: archived only once the output is out (#162).
    Object.defineProperty(out, "afterOutput", {
      value: () => {
        try {
          archive(root, key, load.path, { via: "hook", owner });
        } catch {}
        markConsumed(root, key, load.meta);
      },
    });
    return out;
  } catch {
    return null;
  }
}
