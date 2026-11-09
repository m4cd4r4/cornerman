#!/usr/bin/env node
// Checkpoint gate client.
//   node gate.mjs next    - finish the current checkpoint (its visible tests must pass) and get the next one
//   node gate.mjs status  - where you are
import { readFileSync } from "node:fs";

const cmd = process.argv[2];
let url;
try {
  url = JSON.parse(readFileSync(new URL("./.gate.json", import.meta.url), "utf8")).url;
} catch {
  console.error("The gate is not running (.gate.json missing). Stop and report this; do not work around it.");
  process.exit(2);
}
const res = cmd === "next" ? await fetch(`${url}/next`, { method: "POST" })
  : cmd === "status" ? await fetch(`${url}/status`)
  : null;
if (!res) {
  console.error("usage: node gate.mjs next | status");
  process.exit(2);
}
process.stdout.write(await res.text());
process.exitCode = res.ok ? 0 : 1;
