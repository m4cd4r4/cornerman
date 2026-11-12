#!/usr/bin/env node
// Context fill for the forced-fill design (pilot 4, 2026-11-12).
// Why: in pilot 3 Default finished all 80 checkpoints at a peak of 867k context with no
// compaction, so the run never reached the state the test compares (a full, compacted window
// vs clearing). Real long sessions fill with tool output the agent does not need; this models
// that. The gate prefixes every reveal with one block, seeded by checkpoint, identical for every
// arm, with no task information in it (no spreadsheet words, no error codes, no rules).
//   import { noise } from "./noise.mjs"; noise("cp12") -> string
//   node noise.mjs cp12          prints the block (calibration)
//   node noise.mjs --stats       chars per block for cp01-80
import { fileURLToPath } from "node:url";

// Size per block, in characters. Calibrated to about 16k tokens (see TASK-DESIGN.md "Pilot 4").
// Must stay under the arm's bashOutputMaxChars (100000) with the spec added.
// Measured 2026-11-12 by the arm smoke fill check: 56,000 chars = 34,799 tokens (1.61 chars/token),
// so 25,700 chars is about 16k. Target: Default compacts between cp30 (after the last chat plant,
// cp29) and cp43 (before the first trigger, cp44) on either pilot's token curve.
export const NOISE_CHARS = 25700;

const PKGS = ["left-pad", "chalk", "debug", "ms", "semver", "minimist", "yargs-parser", "picomatch",
  "micromatch", "braces", "fill-range", "to-regex-range", "is-number", "kind-of", "once", "wrappy",
  "inherits", "glob", "minimatch", "brace-expansion", "balanced-match", "concat-map", "rimraf",
  "mkdirp", "graceful-fs", "safe-buffer", "string_decoder", "readable-stream", "util-deprecate",
  "core-util-is", "isarray", "process-nextick-args", "ansi-regex", "strip-ansi", "ansi-styles",
  "color-convert", "color-name", "supports-color", "has-flag", "escape-string-regexp", "signal-exit",
  "which", "isexe", "cross-spawn", "path-key", "shebang-command", "shebang-regex", "lru-cache",
  "yallist", "commander", "lodash.merge", "lodash.debounce", "uuid", "mime-types", "mime-db",
  "negotiator", "accepts", "bytes", "depd", "statuses", "http-errors", "toidentifier", "setprototypeof",
  "ee-first", "on-finished", "encodeurl", "escape-html", "etag", "fresh", "range-parser", "vary"];
const STEPS = ["resolve", "fetch", "verify", "extract", "link", "cache-hit", "cache-store", "audit"];
const WORKERS = ["bf-worker-01", "bf-worker-02", "bf-worker-03", "bf-worker-04", "bf-worker-05", "bf-worker-06"];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function noise(cp, chars = NOISE_CHARS) {
  const n = Number(String(cp).replace(/\D/g, ""));
  const r = rng(0x51f15e + n * 7919);
  const pick = (xs) => xs[Math.floor(r() * xs.length)];
  const hex = (len) => Array.from({ length: len }, () => "0123456789abcdef"[Math.floor(r() * 16)]).join("");
  let ms = Date.UTC(2026, 0, 5, 2, 0, 0) + n * 3600000;
  const lines = [`=== build-farm log, mirror sync job ${1000 + n} (automated; nothing in it concerns your task) ===`];
  let size = lines[0].length + 1;
  while (size < chars) {
    ms += Math.floor(r() * 900) + 20;
    const p = pick(PKGS), v = `${Math.floor(r() * 9)}.${Math.floor(r() * 20)}.${Math.floor(r() * 30)}`;
    const line = `${new Date(ms).toISOString()} ${pick(WORKERS)} ${pick(STEPS).padEnd(11)} ${p}@${v} ${(r() * 400).toFixed(1)} kB sha1-${hex(12)} ${Math.floor(r() * 300)}ms ok`;
    lines.push(line);
    size += line.length + 1;
  }
  lines.push(`=== end of build-farm log, job ${1000 + n} ===`);
  return lines.join("\n") + "\n";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "--stats") {
    const sizes = Array.from({ length: 80 }, (_, i) => noise(`cp${String(i + 1).padStart(2, "0")}`).length);
    console.log(`blocks 80, min ${Math.min(...sizes)}, max ${Math.max(...sizes)} chars; cp01 == cp01: ${noise("cp01") === noise("cp01")}; cp01 != cp02: ${noise("cp01") !== noise("cp02")}`);
  } else process.stdout.write(noise(process.argv[2] || "cp01"));
}
