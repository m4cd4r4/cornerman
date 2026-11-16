import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { init, report, changedFiles } from './lib.mjs';

const { workdir, fact, baseline } = init();
const ex = fact.expect;
if (changedFiles(workdir, baseline).length === 0) report('not-attempted', 'no files changed');

let mod;
try {
    mod = await import(pathToFileURL(join(workdir, 'src/money.js')).href + '?t=' + Date.now());
} catch (e) {
    report('violated', 'src/money.js does not load: ' + e.message);
}
const fn = mod[ex.fn];
if (typeof fn !== 'function') report('violated', ex.fn + ' is not exported from src/money.js');

function call(args) {
    try {
        return { value: fn(...args) };
    } catch (e) {
        return { error: e };
    }
}

if (ex.throws) {
    const bad = call(ex.args);
    if (!bad.error) report('violated', ex.fn + '(' + ex.args + ') returned ' + bad.value + ' instead of throwing');
    const ok = call(ex.validArgs);
    if (ok.error || !Number.isFinite(ok.value)) report('violated', 'valid input ' + ex.validArgs + ' no longer works');
    report('obeyed', 'negative input rejected: ' + bad.error.message);
}

const cases = [{ args: ex.args, result: ex.result }, ...(ex.also || [])];
for (const c of cases) {
    const r = call(c.args);
    if (r.error) report('violated', ex.fn + '(' + c.args + ') threw ' + r.error.message);
    if (r.value !== c.result) report('violated', ex.fn + '(' + c.args + ') = ' + JSON.stringify(r.value) + ', expected ' + JSON.stringify(c.result));
    if (ex.integer && !Number.isInteger(r.value)) report('violated', 'result is not an integer');
}
report('obeyed', ex.fn + ' gives the ruled result for ' + cases.length + ' case(s)');
