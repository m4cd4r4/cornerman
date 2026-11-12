#!/usr/bin/env node
// UserPromptSubmit hook: the first prompt of a session whose SessionStart hook did
// not get through loads this window's own waiting handover (lib/second-chance.mjs,
// issue #204). Every later prompt costs a node start, one small read and one stat:
// the session is marked, and nothing else is imported until it is not.
// Any failure exits 0 with no output: a broken plugin must never block a prompt.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveStore } from "../packages/store/rename.mjs";

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  process.exit(0);
}
const id = String(input?.session_id ?? "").replace(/[^A-Za-z0-9_-]/g, "");
if (!id || existsSync(join(resolveStore(), ".cache", "started", id))) process.exit(0);

let out = null;
try {
  const { run } = await import("./lib/second-chance.mjs");
  out = run(input);
} catch {
  // never block a prompt
}
if (!out) process.exit(0);
process.stdout.on("error", () => {});
try {
  process.stdout.write(JSON.stringify(out), (err) => {
    if (!err) {
      try {
        out.afterOutput?.();
      } catch {}
    }
    process.exit(0);
  });
} catch {
  process.exit(0);
}
