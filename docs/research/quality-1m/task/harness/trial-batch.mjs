#!/usr/bin/env node
// trial-batch.mjs: the ask-wording A/B batch (TASK-DESIGN.md, "Ask-wording A/B"). REAL spend.
//   node trial-batch.mjs --budget 8
// Runs up to 9 trials, round-robin v072, c214, short (so a batch cut short stays balanced), each
// one fork.mjs setup / verify / run / park. Every run gets Q1M_CAP_USD = what is left of the budget,
// so fork.mjs's watchdog kills a trial that would pass it. The ledger is I:/Scratch/_q1m-fork/ab-ledger.json
// and a rerun picks up after the trials already parked.
// Stops early:
//   - when what is left is under MIN_LEFT (a trial whose prefix is cached costs about US$0.5),
//   - when a trial after the first costs over CACHE_MISS (its 556k prefix was not a cache read, so
//     each trial would cost about US$1.9 and the budget buys 4, not 9: Macdara decides),
//   - on any outcome that is not obeyed / ignored / ended (a harness fault, not a result).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf("--budget");
const BUDGET = i === -1 ? NaN : Number(process.argv[i + 1]);
if (!(BUDGET > 0 && BUDGET <= 8)) throw new Error("--budget <US$, at most 8> (the approved A/B cap)");
const PARK = "I:/Scratch/_q1m-fork", LEDGER = join(PARK, "ab-ledger.json");
const MIN_LEFT = 0.75, CACHE_MISS = 1.0;
const ORDER = [1, 2, 3].flatMap((r) => ["v072", "c214", "short"].map((v) => `fork-clear214-ask${v}-sonnet-r${r}`));

const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { budget: BUDGET, trials: [] };
const spent = () => ledger.trials.reduce((a, t) => a + (t.estimateUsd || 0), 0);
const save = () => writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
const fork = (cmd, name, env = {}) => {
  const r = spawnSync(process.execPath, [join(HERE, "fork.mjs"), cmd, name], { stdio: "inherit", env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`fork.mjs ${cmd} ${name} -> exit ${r.status}`);
};

for (const name of ORDER) {
  if (ledger.trials.some((t) => t.name === name)) continue;
  const left = BUDGET - spent();
  if (left < MIN_LEFT) { console.log(`STOP: US$${left.toFixed(2)} left, under ${MIN_LEFT}`); break; }
  console.log(`\n=== ${name}: cap US$${left.toFixed(2)} (spent ${spent().toFixed(2)} of ${BUDGET})`);
  const t0 = Date.now();
  fork("setup", name);
  fork("verify", name);
  const setupSec = Math.round((Date.now() - t0) / 1000);
  try { fork("run", name, { Q1M_CAP_USD: left.toFixed(2) }); }
  finally { fork("park", name); }
  const rec = JSON.parse(readFileSync(join(PARK, name, "out", "TRIAL.json"), "utf8"));
  ledger.trials.push({ name, variant: rec.variant, outcome: rec.outcome, askOnCall: rec.askOnCall, callsAfterAsk: rec.callsAfterAsk, estimateUsd: rec.estimateUsd, setupSec });
  save();
  console.log(`=== ${name}: ${rec.outcome}, US$${rec.estimateUsd}, spent ${spent().toFixed(2)}`);
  if (!["obeyed", "ignored", "ended"].includes(rec.outcome)) { console.log(`STOP: outcome ${rec.outcome} is a harness fault, not a result`); break; }
  if (ledger.trials.length > 1 && rec.estimateUsd > CACHE_MISS) { console.log(`STOP: US$${rec.estimateUsd} for a trial after the first: the prefix cache did not hold`); break; }
}
const by = {};
for (const t of ledger.trials) (by[t.variant] ??= []).push(t.outcome);
console.log(`\nA/B so far: ${JSON.stringify(by)}; spent US$${spent().toFixed(2)} of ${BUDGET}`);
