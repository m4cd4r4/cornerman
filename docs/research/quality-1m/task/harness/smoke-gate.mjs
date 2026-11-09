#!/usr/bin/env node
// Free dry run of the gate: starter repo + reference, through every checkpoint.
//   node smoke-gate.mjs --work <empty dir>
// Checks: the stub is refused, the reference passes each gate, one snapshot per checkpoint,
// visible-test hashes recorded, ALL DONE at the end, status reports done.
import { cpSync, mkdirSync, existsSync, readdirSync, readFileSync, appendFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK = resolve(HERE, "..");
const work = process.argv[process.argv.indexOf("--work") + 1];
if (process.argv.indexOf("--work") === -1) throw new Error("need --work");
if (existsSync(work) && readdirSync(work).length) throw new Error("--work not empty");
const repo = join(work, "repo");
const run = join(work, "run");
cpSync(join(TASK, "starter"), repo, { recursive: true });
mkdirSync(run, { recursive: true });
const git = (...a) => spawnSync("git", a, { cwd: repo, encoding: "utf8" });
git("init", "-q");
git("add", "-A");
git("-c", "user.email=smoke@local", "-c", "user.name=smoke", "commit", "-q", "-m", "start");

const server = spawn(process.execPath, [join(HERE, "gate-server.mjs"), "--repo", repo, "--run", run], { stdio: ["ignore", "pipe", "inherit"] });
await new Promise((ok) => server.stdout.once("data", ok));
const gate = (cmd) => spawnSync(process.execPath, ["gate.mjs", cmd], { cwd: repo, encoding: "utf8" });

const fails = [];
const expect = (cond, msg) => { if (!cond) fails.push(msg); };
try {
  let r = gate("next");
  expect(r.status === 0 && /Checkpoint 1/.test(r.stdout), "first next reveals cp01");
  r = gate("next");
  expect(r.status === 1 && /Not yet/.test(r.stdout), "stub is refused");
  cpSync(join(TASK, "reference", "src"), join(repo, "src"), { recursive: true });
  const total = readdirSync(join(TASK, "checkpoints")).filter((d) => /^cp\d\d$/.test(d)).length;
  const probes = JSON.parse(readFileSync(join(HERE, "probes.json"), "utf8")).probes;
  const stops = [];
  for (let i = 2; i <= total + 1; i++) {
    r = gate("next");
    const probe = probes.find((p) => p.after === `cp${String(i - 1).padStart(2, "0")}`);
    if (probe) {
      // Refused with only ids + asks; a partial PROBES.md is refused again; a full one passes.
      stops.push(probe.id);
      const ids = probe.questions.map((q) => q.id);
      expect(r.status === 1 && /recall check/.test(r.stdout) && ids.every((id) => r.stdout.includes(`${id}: `)), `${probe.id} asked after cp${i - 1}`);
      const leak = (q) => typeof q.answer === "string" && q.answer.length > 3 && !probe.questions.some((o) => o.ask.includes(q.answer)) && r.stdout.includes(q.answer);
      expect(!probe.questions.some(leak) && !/"answer"/.test(r.stdout), `${probe.id} leaks no answer`);
      appendFileSync(join(repo, "PROBES.md"), ids.slice(0, -1).map((id) => `${id}: x`).join("\n") + `\n${ids.at(-1)}:\n`);
      r = gate("next");
      expect(r.status === 1 && r.stdout.includes(`Still unanswered: ${ids.at(-1)}`), `${probe.id} partial answers refused`);
      appendFileSync(join(repo, "PROBES.md"), `${ids.at(-1)}: y\n`);
      r = gate("next");
      expect(existsSync(join(run, `probes-${probe.id}.md`)), `${probe.id} answers copied to the run dir`);
    }
    if (i > total) expect(r.status === 0 && /ALL DONE/.test(r.stdout), "ALL DONE after last");
    else expect(r.status === 0 && new RegExp(`Checkpoint ${i}\\b`).test(r.stdout), `reveals cp${String(i).padStart(2, "0")}`);
  }
  expect(stops.join(",") === probes.map((p) => p.id).join(","), `probe stops ${stops.join(",")}`);
  r = gate("status");
  expect(JSON.parse(r.stdout).done === true, "status done");
  const snaps = readdirSync(join(run, "snapshots"));
  expect(snaps.length === total, `${total} snapshots (got ${snaps.length})`);
  const st = JSON.parse(readFileSync(join(run, "gate-state.json"), "utf8"));
  expect(Object.keys(st.visibleHashes).length === total, "visible hashes recorded");
  expect(!existsSync(join(run, "snapshots", "cp01-done", ".git")), "snapshots exclude .git");
  const events = readFileSync(join(run, "gate-log.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l).event);
  expect(events.filter((e) => e === "probe-asked").length === probes.length && events.filter((e) => e === "probe-answered").length === probes.length, "probe events logged once each");
  expect(events.filter((e) => e === "done").length === total, "one done event per checkpoint");
  expect(!existsSync(join(repo, "probes.json")), "answer key not in the repo");
} finally {
  server.kill();
}
console.log(fails.length ? `SMOKE FAIL\n${fails.map((f) => `  - ${f}`).join("\n")}` : "SMOKE OK");
process.exitCode = fails.length ? 1 : 0;
