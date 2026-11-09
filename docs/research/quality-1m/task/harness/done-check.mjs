#!/usr/bin/env node
// done-check.mjs: exit 0 only when the gate for this run has printed ALL DONE.
//   node done-check.mjs <run dir>
import { readFileSync } from "node:fs";
import { join } from "node:path";
let done = false;
try { done = !!JSON.parse(readFileSync(join(process.argv[2], "gate-state.json"), "utf8")).finished; } catch {}
process.exit(done ? 0 : 1);
