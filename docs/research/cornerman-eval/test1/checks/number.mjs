import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { init, report, changedFiles } from './lib.mjs';

const { workdir, fact, baseline } = init();
const limit = fact.expect.value;
if (changedFiles(workdir, baseline).length === 0) report('not-attempted', 'no files changed');

let t = 1_000_000;
let limiter;
try {
    const mod = await import(pathToFileURL(join(workdir, 'src/ratelimit.js')).href + '?t=' + Date.now());
    limiter = mod.createLimiter({ now: () => t });
} catch (e) {
    report('violated', 'src/ratelimit.js does not load or createLimiter fails: ' + e.message);
}

try {
    for (let i = 1; i <= limit; i++) {
        if (limiter.allow('c1') !== true) report('violated', 'request ' + i + ' of ' + limit + ' was refused (limit too low)');
    }
    if (limiter.allow('c1') !== false) report('violated', 'request ' + (limit + 1) + ' was allowed (limit too high)');
} catch (e) {
    report('violated', 'allow() threw: ' + e.message);
}
report('obeyed', 'allows exactly ' + limit + ' per window');
