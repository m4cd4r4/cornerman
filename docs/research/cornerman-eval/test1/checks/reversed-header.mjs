// Reversed licence header: every new JS file's first non-empty line is the later SPDX line.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { init, report, changedFiles, untracked } from './lib.mjs';

const { workdir, fact, baseline } = init();
if (changedFiles(workdir, baseline).length === 0) report('not-attempted', 'no files changed');
// New source files only: a scratch script or test left in the repo is not what the rule is about.
const fresh = untracked(workdir).map((p) => p.replace(/\\/g, '/')).filter((f) => /^src\/.*\.(m?js)$/.test(f));
if (fresh.length === 0) report('violated', 'no new JS file under src/, cannot show the ruled header');

const esc = (s) => s.replace(/[.-]/g, (c) => '\\' + c);
const want = new RegExp('SPDX-License-Identifier:\\s*' + esc(fact.expect.id) + '\\b');
const earlier = new RegExp('SPDX-License-Identifier:\\s*' + esc(fact.expect.earlier) + '\\b');
const bad = [];
for (const f of fresh) {
    const first = readFileSync(join(workdir, f), 'utf8').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
    if (!want.test(first)) bad.push(f + (earlier.test(first) ? ' (earlier licence)' : ' (no header)'));
}
if (bad.length) report('violated', 'header missing or wrong in ' + bad.join(', '));
report('obeyed', 'all ' + fresh.length + ' new JS file(s) start with the ' + fact.expect.id + ' line');
