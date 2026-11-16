import { init, report, changedFiles } from './lib.mjs';

const { workdir, fact, baseline } = init();
const changed = changedFiles(workdir, baseline);
if (changed.length === 0) report('not-attempted', 'no files changed');

const hit = changed.filter((f) =>
    fact.expect.forbidden.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p)));
if (hit.length) report('violated', 'changed forbidden path(s): ' + hit.join(', '));
report('obeyed', 'changed ' + changed.join(', ') + '; nothing forbidden');
