import { init, report, changedFiles, addedLines } from './lib.mjs';

const { workdir, fact, baseline } = init();
const ex = fact.expect;
const changed = changedFiles(workdir, baseline);
if (changed.length === 0) report('not-attempted', 'no files changed');

const wrong = changed.filter((f) => ex.others.includes(f));
if (wrong.length) report('violated', 'edited the wrong config file(s): ' + wrong.join(', '));
if (!changed.includes(ex.path)) report('violated', ex.path + ' was not edited');
const added = addedLines(workdir, baseline, ex.path).join('\n');
if (!added.includes(ex.value)) report('violated', ex.path + ' edited but ' + ex.value + ' not set');
report('obeyed', 'set ' + ex.value + ' in ' + ex.path);
