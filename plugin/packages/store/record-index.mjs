// A small index of the store's records, kept in <root>/.cache/records.json.
//
// A SessionStart hook is a fresh process, so the in-memory parse cache in store.mjs
// is always cold there. Reading all 2,268 record files to find the few waiting ones
// took 3.6 s on Windows (2026-11-12, issue #204), with 18-34 other hooks starting at
// the same moment. Each entry keeps a record's few routing fields with the file's
// mtime and size; a file whose mtime or size has moved is read again, so a stale
// entry costs one read, never a wrong answer. Machine-local: the sync ignores .cache/.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const VERSION = 1;

export const indexPath = (root) => join(root, ".cache", "records.json");

/** The fields a caller may filter on before the full record is read. */
export function summaryOf(r) {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    createdAt: r.createdAt,
    repoPath: r.repoPath,
    mainPath: r.mainPath,
    owner: r.owner,
    machine: r.machine,
    pinned: r.pinned === true,
    deletedAt: r.deletedAt,
    sessionId: r.sessionId,
    archivedBy: r.archivedBy,
  };
}

/** file name -> { m: mtimeMs, s: size, r: summary }. Empty when missing or unreadable. */
export function loadIndex(root) {
  try {
    const j = JSON.parse(readFileSync(indexPath(root), "utf8"));
    if (j?.v === VERSION && j.files && typeof j.files === "object") return new Map(Object.entries(j.files));
  } catch {
    // no index yet, or a torn one: rebuilt from the files
  }
  return new Map();
}

/** Write the index whole, through a temp file so a reader never sees half of it. Best effort. */
export function saveIndex(root, index) {
  const path = indexPath(root);
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(tmp, JSON.stringify({ v: VERSION, files: Object.fromEntries(index) }));
    renameSync(tmp, path);
  } catch {
    // A missed write costs the next run some reads, nothing else.
  }
}
