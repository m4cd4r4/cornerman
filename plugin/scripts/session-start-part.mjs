#!/usr/bin/env node
// Second SessionStart hook: prints the part of the session-start context the main hook
// (session-start.mjs) could not fit under Claude Code's 10,000-character cap on one hook output,
// usually the loaded handover's standing rules (lib/start-parts.mjs, fault 6 of cornerman-eval
// stage A). It decides nothing: it waits for the spool the main hook writes on every path and
// prints what is in it, or nothing. Any failure exits 0 with no output.
import { readFileSync } from "node:fs";
import { storeRoot } from "./lib/store.mjs";
import { takeSpool } from "./lib/start-parts.mjs";

// A spool written before this hook started belongs to an earlier start; the main hook starts
// with this one, and the slack covers a clock read a moment apart.
const since = Date.now() - 5_000;
// Run with "reply" (the third SessionStart command), it prints what the loaded handover's session
// last said before a /clear instead (lib/last-reply.mjs), from its own spool.
const part = process.argv[3] === "reply" ? "reply" : "";
try {
  const input = JSON.parse(readFileSync(0, "utf8") || "{}");
  const text = takeSpool(storeRoot(), input, { since, part });
  if (text) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } }));
} catch {
  // never block a session
}
