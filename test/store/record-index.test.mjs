// Issue #204: a SessionStart hook read every record file in full, 2,268 of them,
// 3.6 s cold on Windows, to find the few that were waiting. The stat-checked index
// in <store>/.cache lets a fresh process skip a record the index rules out.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { save } from "../../plugin/packages/store/store.mjs";

const STORE = pathToFileURL(join(import.meta.dirname, "..", "..", "plugin", "packages", "store", "store.mjs")).href;

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "cm-index-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const BASE = { body: "body", repoPath: "/code/widget-shop", machine: "desk", pid: 1 };

// A fresh process, so nothing is remembered in memory: only the index on disk.
const waitingTitles = () =>
  JSON.parse(
    execFileSync(
      process.execPath,
      ["--input-type=module", "-e", `const { listAll } = await import(${JSON.stringify(STORE)}); console.log(JSON.stringify(listAll(process.argv[1], { where: (s) => s.status === "waiting" }).map((r) => r.title).sort()));`, root],
      { encoding: "utf8" },
    ),
  );

describe("the record index", () => {
  it("lets a fresh process skip a record the index rules out, without reading it", () => {
    save({ ...BASE, title: "live", createdAt: "2026-11-01T00:00:00.000Z", status: "waiting" }, { root });
    const done = save({ ...BASE, title: "done", createdAt: "2026-11-02T00:00:00.000Z", status: "archived", archivedAt: "2026-11-02T01:00:00.000Z" }, { root });
    expect(waitingTitles()).toEqual(["live"]);

    // Make the archived file say "waiting" without changing its size or mtime. Only
    // a read of the file can see this; a run that trusts the index does not.
    const { atimeMs, mtimeMs } = statSync(done.path);
    const text = readFileSync(done.path, "utf8");
    const tampered = text.replace('"archived"', '"waiting" ');
    expect(tampered.length).toBe(text.length);
    writeFileSync(done.path, tampered);
    utimesSync(done.path, atimeMs / 1000, mtimeMs / 1000);
    expect(Math.floor(statSync(done.path).mtimeMs)).toBe(Math.floor(mtimeMs));

    expect(waitingTitles()).toEqual(["live"]);
    // The control: without the index the same query reads the file and sees it.
    rmSync(join(root, ".cache"), { recursive: true, force: true });
    expect(waitingTitles()).toEqual(["done", "live"]);
  });
});
