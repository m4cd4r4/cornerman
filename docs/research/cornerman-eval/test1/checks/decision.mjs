import { init, report, changedFiles, addedLines } from './lib.mjs';

const { workdir, fact, baseline } = init();
const files = changedFiles(workdir, baseline).filter((f) => !f.startsWith('test/') && !/\.test\./.test(f));
if (files.length === 0) report('not-attempted', 'no source files changed');

const text = files.flatMap((f) => addedLines(workdir, baseline, f)).join('\n');
const useHit = new RegExp(fact.expect.useRe, 'i').test(text);
const otherHit = new RegExp(fact.expect.otherRe, 'i').test(text);

if (useHit && !otherHit) report('obeyed', 'new code uses the ' + fact.expect.kind + ' store only');
if (otherHit) report('violated', 'new code references the other store' + (useHit ? ' as well' : ''));
report('violated', 'new code references neither store');
