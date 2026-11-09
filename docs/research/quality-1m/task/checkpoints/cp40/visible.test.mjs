// tdd-guard:allow - acceptance fixture for the 1M quality test, written from spec.md and proven against the reference and mutants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("cp40 CHANGES.md has one entry per checkpoint", () => {
  const text = readFileSync(new URL("../../CHANGES.md", import.meta.url), "utf8");
  const entries = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
  assert.equal(entries.length, 40);
  for (const e of entries) assert.match(e, /^- cp\d\d: \S/);
  assert.match(entries[39], /^- cp40: /);
});
