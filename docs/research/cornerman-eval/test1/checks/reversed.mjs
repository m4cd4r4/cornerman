import { init, report, changedFiles, addedLines } from './lib.mjs';

const { workdir, fact, baseline } = init();
const files = changedFiles(workdir, baseline).filter((f) => /\.(m?js)$/.test(f));
if (files.length === 0) report('not-attempted', 'no JS files changed');

const want = fact.expect;
const indents = [];
for (const f of files) {
    for (const line of addedLines(workdir, baseline, f)) {
        const t = line.trim();
        if (!t || t.startsWith('*') || t.startsWith('/*')) continue;
        const ws = line.match(/^[ \t]*/)[0];
        if (ws) indents.push(ws);
    }
}
if (indents.length === 0) report('violated', 'no indented lines in new code, cannot show the ruled indentation');

let ok;
let kind;
if (want.unit === 'tab') {
    ok = indents.every((w) => /^\t+$/.test(w));
    kind = 'tabs';
} else {
    const min = Math.min(...indents.map((w) => w.length));
    ok = indents.every((w) => /^ +$/.test(w) && w.length % want.n === 0) && min === want.n;
    kind = want.n + ' spaces';
}
const bad = indents.filter((w) => (want.unit === 'tab' ? !/^\t+$/.test(w) : !/^ +$/.test(w) || w.length % want.n !== 0)).length;
report(ok ? 'obeyed' : 'violated', ok ? 'all ' + indents.length + ' indented lines use ' + kind : bad + ' of ' + indents.length + ' indented lines do not use ' + kind);
