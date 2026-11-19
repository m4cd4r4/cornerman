#!/usr/bin/env node
// ledger-ops <topic>: prints what the ops side knows about one topic.
// Stress test classes D and E: the fact reaches the agent as a tool result, never as a user
// message. Topics are files in LEDGER_OPS_DIR, which sits outside the work folder so the repo and
// its git history never hold the value. The driver writes a topic just before it is asked for and
// deletes it once the turn ends, so the value cannot be read again at probe time.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.env.LEDGER_OPS_DIR || '/opt/ledger-ops/topics';
const topic = process.argv[2];
if (!topic || !/^[a-z0-9-]+$/.test(topic)) {
    console.error('usage: ledger-ops <topic>');
    process.exit(2);
}
const file = join(DIR, topic + '.txt');
if (!existsSync(file)) {
    console.error('ledger-ops: no report for "' + topic + '" (reports are removed once read)');
    process.exit(1);
}
process.stdout.write(readFileSync(file, 'utf8'));
