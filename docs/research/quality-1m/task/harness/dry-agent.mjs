#!/usr/bin/env node
// dry-agent.mjs: what the stub "model" runs each turn in the dry check (retest-dry.mjs), from the
// agent repo as its cwd. The repo holds the reference solution, so there is nothing to build:
// commit as the house rules ask (`cpNN: ...`), answer a recall check with placeholder lines, and
// ask the gate for the next checkpoint. Prints the gate's reply, as `node gate.mjs next` would.
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";

const git = (...a) => execFileSync("git", a, { encoding: "utf8" });
const url = JSON.parse(readFileSync(".gate.json", "utf8")).url;
const status = async () => JSON.parse(await (await fetch(`${url}/status`)).text());
const next = async () => (await fetch(`${url}/next`, { method: "POST" })).text();

const cp = String((await status()).current).padStart(2, "0");
git("add", "-A", "--", ".", ":!test/visible");
git("commit", "-q", "--allow-empty", "-m", `cp${cp}: dry`);
let out = await next();
const probe = /recall check (P\d+)/.exec(out);
if (probe) {
  const ids = [...out.matchAll(/^(P\d+\.\d+): /gm)].map((m) => m[1]);
  appendFileSync("PROBES.md", ids.map((id) => `${id}: dry`).join("\n") + "\n");
  git("add", "PROBES.md");
  git("commit", "-q", "-m", `cp${cp}: dry probe ${probe[1]}`);
  out = await next();
}
process.stdout.write(out);
