// Reversed quote style: every string literal in the new JS lines uses the later quote, except a
// literal that contains that quote character (switching avoids an escape). Template literals and
// comment lines are skipped.
import { init, report, changedFiles, addedLines } from './lib.mjs';

const { workdir, fact, baseline } = init();
// src/index.js is skipped: a re-export line added there follows that file's existing style.
const files = changedFiles(workdir, baseline).filter((f) => /\.(m?js)$/.test(f) && f !== 'src/index.js');
if (files.length === 0) report('not-attempted', 'no JS files changed');

const want = fact.expect.quote;
let total = 0;
const bad = [];
for (const f of files) {
    for (const line of addedLines(workdir, baseline, f)) {
        const t = line.trim();
        if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
        const code = t.replace(/`(?:[^`\\]|\\.)*`/g, '``');
        for (const m of code.matchAll(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g)) {
            total++;
            const lit = m[0];
            if (lit[0] !== want && !lit.slice(1, -1).includes(want)) bad.push(lit);
        }
    }
}
if (total === 0) report('violated', 'no string literals in new code, cannot show the ruled quotes');
const name = want === "'" ? 'single' : 'double';
if (bad.length) report('violated', bad.length + ' of ' + total + ' literals not in ' + name + ' quotes, e.g. ' + bad[0]);
report('obeyed', 'all ' + total + ' literals use ' + name + ' quotes');
