// Paths in a handover that do not open from the folder it is filed against.
//
// Field audit, 2026-11-28, 14 days of real handovers: 922 relative paths under Next action,
// Read first and Key files did not open from the handover's repo, mostly because the handover was
// filed under the session root (the home folder, another project) while its paths belong to the
// repo the work was in; 513 of them opened from another checkout or from a repo the handover names.
// Absolute paths went wrong too: the plan named in the main checkout while it lived in a worktree
// (7 of 8 wrong-checkout cases). The next session opens what it is given, finds nothing, and either
// guesses or carries on without the file.
//
// This finds each such path and where it really is, without a model and without changing the
// handover's text: save.mjs prints them so the saving session can fix them, and the load notice
// gives the next session the real location.
import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative } from "node:path";
import { worktreePaths } from "../../packages/store/worktree.mjs";
import { sections } from "./carry.mjs";

// The sections whose paths a session is told to open or act on.
const PATH_SECTIONS = /^(?:next action|read first|key files|also read)/i;
// A path the next session must open: one that does not exist anywhere is worth saying too.
const MUST_EXIST = /^read first/i;

// Drive letter or "~/" paths. UNC paths (\\server\share, //server/share) are never touched: on
// Windows checking one makes a network call that can hand over the user's credentials.
// A brace list or a glob is a pattern, not a path, so the path stops before it.
const ABS = /(?<![\w/\\])(?:[A-Za-z]:[\\/]|~[\\/])[^\s`'"()<>,;|*?{}]+/g;
// A POSIX absolute path, on Linux and macOS only: at least two segments, so "/clear" and "/relay off"
// (slash commands) are not paths, and the first segment starts with a word character, so a UNC
// "//server/share" is not one either. On Windows "/tmp/x" names a folder on another machine (a VPS)
// as often as one here, so it is left alone.
const POSIX_ABS = /(?<![\w/\\.:~-])\/[\w.-]+\/[^\s`'"()<>,;|*?{}]+/g;
const URL = /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi;
// A relative path with at least one folder and a file extension: "docs/plan.md", "src/a/b.ts".
// Not the tail of a brace list ("{a,b}-cheatsheet/X.md" is no path "-cheatsheet/X.md").
const REL = /(?<![\w/.~:\\{},*-])[\w.][\w.-]*(?:\/[\w.-]+)+\.[A-Za-z0-9]{1,6}\b/g;
const trimEnd = (p) => p.replace(/[.:]+$/, "");

const expand = (p) => (/^~[\\/]/.test(p) ? join(homedir(), p.slice(2)) : p);
const exists = (p) => {
  try {
    return existsSync(p);
  } catch {
    return false;
  }
};
const isDir = (p) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/** The checkout a path is inside: the nearest existing folder above it holding `.git`, or "". */
function checkoutOf(p) {
  let dir = isDir(p) ? p : dirname(p);
  for (;;) {
    if (exists(join(dir, ".git"))) return dir;
    const up = dirname(dir);
    if (up === dir) return "";
    dir = up;
  }
}

/** The absolute and relative paths a piece of text names, each once. */
export function pathsIn(text, platform = process.platform) {
  const noUrls = String(text).replace(URL, " ");
  const posix = platform === "win32" ? [] : noUrls.replace(ABS, " ").match(POSIX_ABS) || [];
  const abs = [...new Set([...(noUrls.match(ABS) || []), ...posix].map(trimEnd))];
  let rest = noUrls.replace(ABS, " ");
  if (platform !== "win32") rest = rest.replace(POSIX_ABS, " ");
  const rel = [...new Set((rest.match(REL) || []).map(trimEnd))];
  return { abs, rel };
}

/**
 * The paths in a handover's Next action, Read first, Key files and Also read sections that do not
 * open from `top`, as [{ section, path, found }]. `found` is where the file is: another checkout of
 * the same repo, a repo the handover names by an absolute path, or one of `roots`. A path found
 * nowhere is listed only from Read first, with `found` "": a file in Next action may be one still to
 * be written. Never throws.
 */
export function pathProblems(body, top, { roots = [] } = {}) {
  try {
    const all = pathsIn(body);
    const named = all.abs.map((p) => checkoutOf(expand(p))).filter(Boolean);
    const homeTop = top ? worktreePaths(top) : [];
    const bases = [...new Set([top, ...homeTop, ...roots, ...named].filter(Boolean))];
    const out = [];
    const seen = new Set();
    for (const s of sections(body)) {
      if (!PATH_SECTIONS.test(s.heading)) continue;
      const { abs, rel } = pathsIn(s.lines.join("\n"));
      const report = (path, found) => {
        if (seen.has(path) || (!found && !MUST_EXIST.test(s.heading))) return;
        seen.add(path);
        out.push({ section: s.heading, path, found });
      };
      for (const p of abs) {
        const full = expand(p);
        if (exists(full)) continue;
        // Named in one checkout, present in another: the plan in a worktree, not the main checkout.
        const home = checkoutOf(full);
        const inside = home ? relative(home, full) : "";
        const found = inside && !isAbsolute(inside) && !inside.startsWith("..") ? worktreePaths(home).map((w) => join(w, inside)).find(exists) : "";
        report(p, found ?? "");
      }
      for (const p of rel) {
        if (top && exists(join(top, p))) continue;
        // "EVAL/stress/driver.mjs": a short name the handover defines for a folder, not a path.
        if (/^[A-Z][A-Z0-9_]+\//.test(p) && !bases.some((b) => exists(join(b, p)))) continue;
        report(p, bases.map((b) => join(b, p)).find(exists) ?? "");
      }
    }
    return out;
  } catch {
    return [];
  }
}
