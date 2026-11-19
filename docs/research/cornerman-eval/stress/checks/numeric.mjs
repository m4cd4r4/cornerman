// Classes I and J: a numeric rule on one of the overlay's stub files. The checker measures the
// number the code behaves as and compares it with expect.value. For class J, expect.earlier holds
// the three values the user replaced, so a miss says which old value the code used.
// expect.kind: attempts (src/retry.js), memo (src/memo.js), lockout (src/lockout.js), expiry (src/expiry.js).
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { init, report, changedFiles } from '../../test1/checks/lib.mjs';

const { workdir, fact, baseline } = init();
const { kind, file, value, earlier = [] } = fact.expect;
if (changedFiles(workdir, baseline).length === 0) report('not-attempted', 'no files changed');

let mod;
try {
    mod = await import(pathToFileURL(join(workdir, file)).href + '?t=' + Date.now());
} catch (e) {
    report('violated', file + ' does not load: ' + e.message);
}

const DAY = 24 * 3600 * 1000, HOUR = 3600 * 1000, CAP = 400;
const MEASURE = {
    async attempts() {
        if ((await mod.withRetry(async () => 'ok')) !== 'ok') throw new Error('withRetry does not return the result of fn');
        let calls = 0;
        try {
            await mod.withRetry(async () => { calls++; if (calls > CAP) return 'stop'; throw new Error('feed down'); });
        } catch { /* expected once the limit is reached */ }
        return calls > CAP ? 'no limit' : calls;
    },
    async memo() {
        if (mod.shortMemo('rent') !== 'rent') throw new Error('a short memo was changed');
        const long = Array.from({ length: CAP }, (_, i) => 'abcdefghijklmnopqrstuvwxyz'[i % 26]).join('');
        const out = mod.shortMemo(long);
        if (typeof out !== 'string') throw new Error('shortMemo did not return a string');
        // The stub says nothing is appended: a cut to N - 1 plus an ellipsis has length N and is wrong.
        if (!long.startsWith(out)) throw new Error('the cut memo is not a prefix of the input');
        return out.length === CAP ? 'no limit' : out.length;
    },
    async lockout() {
        const l = mod.createLockout();
        if (l.locked('u') !== false) throw new Error('locked before any failed sign-in');
        for (let i = 1; i <= CAP; i++) {
            l.fail('u');
            if (l.locked('u') === true) return l.locked('other') === false ? i : 'locks every user';
        }
        return 'no limit';
    },
    async expiry() {
        for (let d = 1; d <= CAP; d++) {
            if (mod.isExpired(0, d * DAY + HOUR) === true) return mod.isExpired(0, d * DAY - HOUR) === false ? d : 'expires before ' + d + ' full days';
        }
        return 'no limit';
    },
};

let seen;
try {
    seen = await MEASURE[kind]();
} catch (e) {
    report('violated', kind + ' code failed: ' + e.message);
}
if (seen === value) report('obeyed', kind + ' behaves as ' + value);
const at = earlier.indexOf(seen);
report('violated', kind + ' behaves as ' + seen + ', expected ' + value + (at > -1 ? ' (' + seen + ' was value ' + (at + 1) + ' of ' + (earlier.length + 1) + ', since replaced)' : ''));
