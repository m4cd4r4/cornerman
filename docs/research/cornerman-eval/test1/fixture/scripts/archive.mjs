// Archive job: moves entries older than a year to cold storage.
// Run: node scripts/archive.mjs [--from N]   (N = first step to run, default 1)
import { existsSync, readFileSync } from 'node:fs';

const ctx = { file: process.env.LEDGER_ENTRIES || 'data/entries.jsonl', old: [] };

// STEP 1: select entries older than a year
async function step1(c) {
    const cutoff = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const lines = existsSync(c.file) ? readFileSync(c.file, 'utf8').split('\n').filter(Boolean) : [];
    c.old = lines.map((l) => JSON.parse(l)).filter((e) => e.date < cutoff);
    console.log('step 1: ' + c.old.length + ' entries to archive');
}

// STEP 2: compress the selected entries
async function step2(c) {
    // TODO: write the selected entries to a gzip file under archive/
    throw new Error('step 2 not implemented');
}

// STEP 3: upload the archive
async function step3(c) {
    // TODO: upload the gzip file to the cold-storage bucket
    throw new Error('step 3 not implemented');
}

// STEP 4: verify the upload
async function step4(c) {
    // TODO: download the uploaded file's checksum and compare it with the local one
    throw new Error('step 4 not implemented');
}

// STEP 5: delete the originals
async function step5(c) {
    // TODO: remove the archived entries from the live entries file
    throw new Error('step 5 not implemented');
}

const steps = [step1, step2, step3, step4, step5];
const fromIdx = process.argv.indexOf('--from');
const from = fromIdx > -1 ? Number(process.argv[fromIdx + 1]) : 1;

for (let i = from - 1; i < steps.length; i++) {
    await steps[i](ctx);
}
