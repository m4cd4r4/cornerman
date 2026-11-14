// The repo a window's folder belongs to, for /cornerman:stats and the sidebar's "This
// month". The last name of the folder was not enough (2026-11-13, a copy of a real
// store): "web" merged three repos, worktrees and subfolders were split from their
// repo, and windows started in a folder that is in no repo each counted as a repo.
//
// A folder belongs to the repo whose .git it sits under; a linked worktree, to the repo
// its .git file points into. A folder that is gone (a removed worktree) belongs to the
// repo beside it whose name it starts with, `<repo>-<slug>`. Read only.
//
// Cost: every path is looked up once per namer, since many folders share parents.
// 457 folders from a real store: about 1 s when each was walked on its own, 2026-11-13.
import { readFileSync, statSync } from "node:fs";

/** The row for windows in a folder that is in no repo. */
export const NO_REPO = "(no repo)";

const parts = (p) => String(p ?? "").split(/[/\\]+/).filter(Boolean);
// "C:" alone is not a folder to stat; "C:/" is.
const pathOf = (ps, absolute) => {
  const p = ps.join("/");
  return /^[A-Za-z]:$/.test(ps[0] ?? "") ? (ps.length === 1 ? `${p}/` : p) : absolute ? `/${p}` : p;
};
const kind = (p) => {
  try {
    const s = statSync(p, { throwIfNoEntry: false });
    return s ? (s.isDirectory() ? "dir" : "file") : "";
  } catch {
    return "";
  }
};

// The repo a .git file points into: `gitdir: <repo>/.git/worktrees/<name>`.
function worktreeRepo(gitFile) {
  let text = "";
  try {
    text = readFileSync(gitFile, "utf8");
  } catch {
    return "";
  }
  const m = /^gitdir:\s*(.+?)\s*$/m.exec(text);
  if (!m) return "";
  const ps = parts(m[1]);
  const at = ps.lastIndexOf("worktrees");
  return at >= 2 && ps[at - 1] === ".git" ? ps[at - 2] : "";
}

/** A function from a folder to its repo's name. It keeps what it looked up. */
export function repoNamer() {
  const named = new Map();
  // Lower-cased: a window's folder can come as i:/x or I:/x for one folder.
  const kinds = new Map();
  const kindOf = (p) => {
    const k = p.toLowerCase();
    let got = kinds.get(k);
    if (got === undefined) kinds.set(k, (got = kind(p)));
    return got;
  };
  const repos = new Map(); // a folder on disk -> its repo's name, or "" when it is in none

  // The repo a folder on disk is in, from its own .git or the nearest parent's.
  const repoAt = (ps, i, absolute) => {
    if (i === 0) return "";
    const dir = pathOf(ps.slice(0, i), absolute);
    const key = dir.toLowerCase();
    let got = repos.get(key);
    if (got !== undefined) return got;
    const git = kindOf(`${dir}/.git`);
    got = git === "dir" ? ps[i - 1] : git === "file" ? worktreeRepo(`${dir}/.git`) || ps[i - 1] : repoAt(ps, i - 1, absolute);
    repos.set(key, got);
    return got;
  };

  const resolve = (cwd) => {
    const ps = parts(cwd);
    if (!ps.length) return NO_REPO;
    const absolute = /^[/\\]/.test(String(cwd));
    let deepest = ps.length; // the deepest folder on the path that is on disk
    while (deepest > 0 && kindOf(pathOf(ps.slice(0, deepest), absolute)) !== "dir") deepest--;
    if (deepest > 0) {
      const repo = repoAt(ps, deepest, absolute);
      if (repo) return repo;
    }
    if (deepest === ps.length) return NO_REPO;
    // Gone: the first missing folder may be a removed worktree, `<repo>-<slug>`, beside
    // its repo. Only the names it starts with are looked at, longest first.
    if (deepest > 0) {
      const gone = ps[deepest];
      const parent = pathOf(ps.slice(0, deepest), absolute);
      for (let at = gone.lastIndexOf("-"); at > 0; at = gone.lastIndexOf("-", at - 1)) {
        const repo = gone.slice(0, at);
        if (kindOf(`${parent}/${repo}/.git`) === "dir") return repo;
      }
    }
    return ps[ps.length - 1];
  };

  return (cwd) => {
    const key = String(cwd ?? "");
    let name = named.get(key);
    if (name === undefined) named.set(key, (name = resolve(key)));
    return name;
  };
}
