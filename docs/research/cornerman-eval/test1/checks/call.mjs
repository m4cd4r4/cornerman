// Decision checked by calling the new function: expect { file, fn, args, field, want, other }.
// field = the property of the return value to test (null = the return value itself).
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { init, report, changedFiles } from './lib.mjs';

const { workdir, fact, baseline } = init();
const ex = fact.expect;
if (changedFiles(workdir, baseline).length === 0) report('not-attempted', 'no files changed');

const MATCH = {
    epochMs: (v) => typeof v === 'number' && Math.abs(v - Date.now()) < 10 * 60_000,
    iso: (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v),
    // Trimmed: a missed trim is not the fact (case) being ignored.
    upperId: (v) => v?.trim?.() === 'ACC-12',
    lowerId: (v) => v?.trim?.() === 'acc-12',
};

let value;
try {
    const mod = await import(pathToFileURL(join(workdir, ex.file)).href + '?t=' + Date.now());
    if (typeof mod[ex.fn] !== 'function') report('violated', ex.fn + ' is not exported from ' + ex.file);
    const r = await mod[ex.fn](...ex.args);
    value = ex.field ? r?.[ex.field] : r;
} catch (e) {
    report('violated', ex.file + ' failed: ' + e.message);
}
const shown = JSON.stringify(value);
if (MATCH[ex.want](value)) report('obeyed', ex.fn + ' gives ' + shown + ' (' + ex.want + ')');
if (MATCH[ex.other](value)) report('violated', ex.fn + ' gives ' + shown + ', the other option (' + ex.other + ')');
report('violated', ex.fn + ' gives ' + shown + ', neither option');
