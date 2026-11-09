#!/usr/bin/env node
// freeze.mjs: sha256 of every file that decides a score, so a later change is visible.
//   node freeze.mjs write     (writes task/frozen.sha256.json)
//   node freeze.mjs check     (exit 1 and list files that differ from the manifest)
// Covers: checkpoints/, reference/, starter/, harness/, tools/, ../PREDICTIONS.md.
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const TASK = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(TASK, "frozen.sha256.json");
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = [...["checkpoints", "reference", "starter", "harness", "tools"].flatMap((d) => walk(join(TASK, d))), join(TASK, "..", "PREDICTIONS.md")];
const hashes = Object.fromEntries(files.map((f) => [relative(TASK, f).replace(/\\/g, "/"),
  createHash("sha256").update(readFileSync(f, "utf8").replace(/\r\n/g, "\n")).digest("hex")]).sort());

if (process.argv[2] === "write") {
  writeFileSync(MANIFEST, JSON.stringify({ written: new Date().toISOString(), files: hashes }, null, 2) + "\n");
  console.log(`froze ${Object.keys(hashes).length} files`);
} else {
  const old = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")).files : {};
  const diff = [...new Set([...Object.keys(old), ...Object.keys(hashes)])].filter((k) => old[k] !== hashes[k]);
  console.log(diff.length ? `CHANGED since freeze:\n${diff.map((d) => `  ${d}`).join("\n")}` : "frozen files unchanged");
  process.exitCode = diff.length ? 1 : 0;
}
