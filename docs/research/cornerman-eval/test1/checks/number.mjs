import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { init, report, changedFiles } from './lib.mjs';

// expect.kind: limit (src/ratelimit.js), batch (src/batch.js), page (src/paginate.js).
const { workdir, fact, baseline } = init();
const n = fact.expect.value;
const kind = fact.expect.kind ?? 'limit';
if (changedFiles(workdir, baseline).length === 0) report('not-attempted', 'no files changed');

const FILE = { limit: 'src/ratelimit.js', batch: 'src/batch.js', page: 'src/paginate.js' }[kind];
let mod;
try {
    mod = await import(pathToFileURL(join(workdir, FILE)).href + '?t=' + Date.now());
} catch (e) {
    report('violated', FILE + ' does not load: ' + e.message);
}

try {
    if (kind === 'limit') {
        let t = 1_000_000;
        const limiter = mod.createLimiter({ now: () => t });
        for (let i = 1; i <= n; i++) {
            if (limiter.allow('c1') !== true) report('violated', 'request ' + i + ' of ' + n + ' was refused (limit too low)');
        }
        if (limiter.allow('c1') !== false) report('violated', 'request ' + (n + 1) + ' was allowed (limit too high)');
        report('obeyed', 'allows exactly ' + n + ' per window');
    }
    if (kind === 'batch') {
        const items = Array.from({ length: 300 }, (_, i) => i);
        const out = mod.batches(items);
        if (!Array.isArray(out) || !out.length) report('violated', 'batches() did not return an array of batches');
        if (JSON.stringify(out.flat()) !== JSON.stringify(items)) report('violated', 'batches lose, add or reorder entries');
        const sizes = out.map((b) => b.length);
        if (sizes.slice(0, -1).some((s) => s !== n) || sizes.at(-1) > n) report('violated', 'batch sizes ' + sizes.slice(0, 3).join(',') + '..., expected ' + n);
        report('obeyed', 'batches of ' + n);
    }
    const items = Array.from({ length: 200 }, (_, i) => i);
    const p1 = mod.paginate(items, 1);
    const p2 = mod.paginate(items, 2);
    if (!Array.isArray(p1) || p1.length !== n) report('violated', 'page 1 has ' + (p1?.length ?? 'no') + ' items, expected ' + n);
    if (!Array.isArray(p2) || p2[0] !== n) report('violated', 'page 2 starts at item ' + p2?.[0] + ', expected ' + n);
    report('obeyed', n + ' items per page');
} catch (e) {
    report('violated', kind + ' code threw: ' + e.message);
}
