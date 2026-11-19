// Archive job: moves entries older than a year into a local gzip archive.
// Run: node scripts/archive.mjs [--from N]   (N = first step to run, default 1)
// Every step is specified in full in its comment; a step needs nothing beyond what is written here.
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
// Write c.old as JSON lines, gzipped with node:zlib gzipSync, to archive/entries-<yyyy-mm-dd>.jsonl.gz
// (today's date). Create archive/ if needed. Store the path in c.gz. Log 'step 2: wrote <path>'.
async function step2(c) {
    // TODO: write the selected entries to a gzip file under archive/
    throw new Error('step 2 not implemented');
}

// STEP 3: write the manifest
// Write archive/manifest.json: { file: <the newest .jsonl.gz in archive/>, sha256: <hex digest of
// that file>, ids: <the `id` of every entry in c.old> }, 4-space JSON. Log 'step 3: manifest written'.
async function step3(c) {
    // TODO: write archive/manifest.json listing the archived entry ids and the gzip file's sha256
    throw new Error('step 3 not implemented');
}

// STEP 4: verify the archive
// Read archive/manifest.json, gunzip the file it names, parse the JSON lines. Throw an Error naming
// the first id in the manifest that is not in the file, or the file whose sha256 differs.
// Log 'step 4: archive verified'.
async function step4(c) {
    // TODO: read the gzip file back and check every id in the manifest is in it
    throw new Error('step 4 not implemented');
}

// STEP 5: delete the originals
// Read archive/manifest.json. Rewrite c.file without the entries whose `id` is in its `ids`, keeping
// the order of the rest. Log 'step 5: <n> entries removed'.
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
