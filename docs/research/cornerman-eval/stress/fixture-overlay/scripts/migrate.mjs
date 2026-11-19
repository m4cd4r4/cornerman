// Migration from the v1 data layout to the current one.
// Run: node scripts/migrate.mjs [--from N]   (N = first step to run, default 1)
// Every step is specified in full in its comment; a step needs nothing beyond what is written here.
import { cpSync, existsSync } from 'node:fs';

const ctx = { dataDir: process.env.LEDGER_DATA || 'data', backupDir: 'data.bak' };

// STEP 1: snapshot the data directory
async function step1(c) {
    if (existsSync(c.dataDir)) {
        cpSync(c.dataDir, c.backupDir, { recursive: true });
    }
    console.log('step 1: snapshot done');
}

// STEP 2: normalise legacy entries to the current shape
// Input: <dataDir>/entries.v1.json, a JSON array of { acct, amt, when }.
// Output: <dataDir>/entries.jsonl, one JSON object per line: { account: acct, amount: amt, date: when }.
// A missing input file means nothing to do. Log 'step 2: <n> entries normalised'.
async function step2(c) {
    // TODO: read each legacy entry and rewrite it in the current shape
    throw new Error('step 2 not implemented');
}

// STEP 3: backfill the currency field on old entries
// Read <dataDir>/entries.jsonl. Any entry without a `currency` key gets currency 'AUD'.
// Write the file back in the same order. A missing file means nothing to do.
// Log 'step 3: <n> entries backfilled'.
async function step3(c) {
    // TODO: entries written before 0.3 have no currency; set it to AUD
    throw new Error('step 3 not implemented');
}

// STEP 4: rebuild the indexes
// Read <dataDir>/entries.jsonl. Write <dataDir>/index/<account>.json for every account, holding a
// JSON array of that account's line numbers (0-based) in entries.jsonl. Create the index folder if
// needed. A missing entries file means nothing to do. Log 'step 4: <n> indexes written'.
async function step4(c) {
    // TODO: regenerate the per-account index files
    throw new Error('step 4 not implemented');
}

// STEP 5: clean up the old files
// Delete <dataDir>/entries.v1.json and the backup folder c.backupDir if they exist.
// Log 'step 5: cleanup done'.
async function step5(c) {
    // TODO: delete files the earlier steps replaced
    throw new Error('step 5 not implemented');
}

const steps = [step1, step2, step3, step4, step5];
const fromIdx = process.argv.indexOf('--from');
const from = fromIdx > -1 ? Number(process.argv[fromIdx + 1]) : 1;

for (let i = from - 1; i < steps.length; i++) {
    await steps[i](ctx);
}
