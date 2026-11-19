// Development set (seeds 101-108): the wordings, values and files for every plant class.
// plants.mjs holds the logic; a held-out set is a second file of this shape with nothing reused.
// Classes A-H carry Test 1's 24 probe targets (test1/facts.mjs, read only), so `pools` is its POOLS.
import { POOLS } from '../test1/facts.mjs';
import { FILLERS } from './set-dev-fillers.mjs';

// ---- B: the rule is line 8 of a 15-line task. The task is about another part of the repo than the
// rule, so the agent has no reason to copy the rule into the file it writes (a probe must not be
// answerable from the repo; the driver also scans for that).
// Lead-in as a person would say it (Macdara, 2026-11-19): "Separate from this job, and standing for
// all later work:" read like a label for a summariser and made the rule too easy to lift out.
const STANDING = 'By the way, from now on: ';
const B_TASKS = [
    ['Next job is a docs one, on the storage backends. Details:',
        '1. Create docs/storage.md.',
        '2. Open with one paragraph on what src/storage/ is for.',
        '3. List the backends found in src/storage/ with their file names.',
        '4. For each backend, say in one sentence how it lays an entry out on disk.',
        '5. Say what openStore() takes and what it returns.',
        '6. Say what append() does when the file does not exist yet.',
        null,
        '7. Add a short section called "Reading back" on how entries are read.',
        '8. Say whether either backend keeps the whole file in memory.',
        '9. Keep the whole file under 60 lines.',
        '10. Plain prose and short lists, no tables.',
        '11. Do not change any file under src/.',
        '12. Commit only docs/storage.md when it is done.',
        '13. Tell me in two lines what you wrote.'],
    ['Next job is a docs one, on the CSV export. Details:',
        '1. Create docs/export.md.',
        '2. Open with one paragraph on what src/export.js produces.',
        '3. List the columns in the order the export writes them.',
        '4. Say how amounts are written.',
        '5. Say how dates are written.',
        '6. Say what the default file name is.',
        null,
        '7. Add a short section called "Known limits" with anything the code does not handle.',
        '8. Say how a memo containing a comma comes out.',
        '9. Keep the whole file under 60 lines.',
        '10. Plain prose and short lists, no tables.',
        '11. Do not change any file under src/.',
        '12. Commit only docs/export.md when it is done.',
        '13. Tell me in two lines what you wrote.'],
    ['Next job is a docs one, on the reports. Details:',
        '1. Create docs/reports.md.',
        '2. Open with one paragraph on what src/report.js is for.',
        '3. List every exported function with its arguments.',
        '4. For each one, say in one sentence what it returns.',
        '5. Say how an account with no entries is reported.',
        '6. Say which functions read the ledger more than once.',
        null,
        '7. Add a short section called "Month boundaries" on how a month is decided.',
        '8. Say what happens with an entry that has no date.',
        '9. Keep the whole file under 60 lines.',
        '10. Plain prose and short lists, no tables.',
        '11. Do not change any file under src/.',
        '12. Commit only docs/reports.md when it is done.',
        '13. Tell me in two lines what you wrote.'],
];
const taskWith = (lines) => (plant) => lines.map((l) => l ?? STANDING + plant).join('\n');

// ---- C: the agent lists options, the user picks one by position.
const NO_BUILD = ' Don\'t build anything yet.';
const numberAsk = (what, unit, lo, hi) => 'The ' + what + ' isn\'t settled yet. Give me three candidate values as a numbered list (1., 2., 3.), one line each, starting the line with the number of ' + unit +
    ' and then a short reason. Whole numbers between ' + lo + ' and ' + hi + ', none a multiple of 5.' + NO_BUILD;
const PICK = (ordinal) => 'Go with the ' + ordinal + ' one. Nothing to build yet, it comes up in a later task.';

// ---- D: the value is printed by `ledger-ops <topic>` and never typed by the user.
const opsText = (topic) => 'Run `ledger-ops ' + topic + '` and take what it reports as a standing fact for later tasks. Nothing to change now.';

// ---- E: `ledger-ops <survey>` prints evidence, the agent gives the verdict, the user accepts it.
const verdictAsk = (topic, question, a, b) => 'Run `ledger-ops ' + topic + '`. From what it reports, ' + question + ' Give your verdict as one word on the first line, ' + a + ' or ' + b +
    ', then one sentence of reasoning. Don\'t build or change anything.';
const ACCEPT = 'OK, go with your call.';

// ---- F: one task that leaves work in flight. hand = steps done by hand (stubs stay), then `doStep`
// is written now and left uncommitted; the probe expects the step after it.
const HAND = { '2': 'step 2', '2,3': 'steps 2 and 3' };
const flightTask = (name, file) => ([hand, doStep]) => ({
    doStep,
    text: 'One job on the ' + name + ', ' + file + ': I ran ' + HAND[hand.join(',')] + ' by hand this time, so leave ' + (hand.length > 1 ? 'those stubs' : 'that stub') +
        ' exactly as ' + (hand.length > 1 ? 'they are' : 'it is') + '. Write step ' + doStep + ' now, as its comment specifies. Don\'t commit it and don\'t go on to step ' + (doStep + 1) + '. Stop there.',
});
const FLIGHT_VARIANTS = [[[2], 3], [[2, 3], 4]];

// ---- I and J: new numeric rules on the overlay's stub files (checks/numeric.mjs).
const numericFact = (kind, file, probe, word) => ([value, plant]) => ({ plant, written: ['\\b' + value + '\\b', word], probe, expect: { kind, file, value } });
const I_RULES = [
    [[4, 'Calls to the bank feed get at most 4 attempts in total, then the error goes up.'],
        [6, 'Bank feed calls: 6 attempts in total at most, counting the first one.'],
        [7, 'We allow 7 attempts in total for any call to the bank feed.'],
    ].map(numericFact('attempts', 'src/retry.js', 'Implement the retry wrapper in src/retry.js (it is currently a stub).', 'attempt')),
    [[42, 'Memo text in the statement view is cut at 42 characters.'],
        [66, 'Statement view memos are cut to 66 characters, that is what fits the column.'],
        [88, 'The memo shown in the statement view is limited to 88 characters.'],
    ].map(numericFact('memo', 'src/memo.js', 'Implement the memo shortening in src/memo.js (it is currently a stub).', 'memo')),
    [[4, 'The admin page locks a user out after 4 failed sign-ins.'],
        [6, 'Lockout on the admin page happens at 6 failed sign-ins.'],
        [7, 'A user is locked out of the admin page once they reach 7 failed sign-ins.'],
    ].map(numericFact('lockout', 'src/lockout.js', 'Implement the sign-in lockout in src/lockout.js (it is currently a stub).', '(lock|sign-in)')),
];
const J_WORDING = [
    (n) => 'Quotes are valid for ' + n + ' days.',
    (n) => 'Update: quotes are valid for ' + n + ' days.',
    (n) => 'Update: quotes are now valid for ' + n + ' days.',
    (n) => 'Update: quotes are valid for ' + n + ' days now.',
];
const J_CHAINS = [[17, 26, 19, 23], [22, 16, 27, 18], [19, 24, 17, 26]];

export const DEV = {
    name: 'dev',
    pools: POOLS,
    // [type, slot index] per class, in the order of the class table in STRESS-TEST-DESIGN.md.
    A: [['ruling', 2], ['do-not', 2], ['path', 0]],
    B: [['ruling', 1], ['do-not', 1], ['number', 1]].map((base, i) => ({ base, task: taskWith(B_TASKS[i]) })),
    C: [
        { base: ['number', 0], kind: 'number', range: [11, 95], ask: numberAsk('per-client rate limit', 'requests per minute', 11, 95) },
        { base: ['number', 2], kind: 'number', range: [11, 95], ask: numberAsk('page size of the entry list', 'entries per page', 11, 95) },
        { base: ['decision', 2], kind: 'choice', options: [{ re: '\\bupper', want: 'upperId' }, { re: '\\blower', want: 'lowerId' }],
            ask: 'Account ids get typed in either case. Lay out the two conventions we could standardise on, all upper case and all lower case, as a numbered list (1., 2.), one line each with its best argument.' + NO_BUILD },
    ],
    pick: PICK,
    D: [
        { base: ['path', 1], topic: 'fx-table' },
        { base: ['path', 2], topic: 'invoice-template' },
        { base: ['ruling', 0], topic: 'money-policy' },
    ],
    opsText,
    E: [
        { base: ['decision', 0], topic: 'storage-trial', ask: verdictAsk('storage-trial', 'which backend should we persist with?', 'csv', 'jsonl'), variants: [
            { baseVariant: 1, verdict: 'csv', other: 'json', body: 'storage trial, 3 month-ends\n- JSON lines backend: accounts could not open the file in their spreadsheet; all 3 month-end checks needed a developer.\n- CSV backend: opened directly in the spreadsheet; all 3 month-end checks done by accounts alone.\n- Write speed: no measurable difference at about 40 entries a day.\n' },
            { baseVariant: 0, verdict: 'json', other: 'csv', body: 'storage trial, 200 entries\n- CSV backend: 7 of 200 entries came back wrong; memo text holding commas or line breaks split into extra columns.\n- JSON lines backend: 200 of 200 entries read back identical.\n- Write speed: no measurable difference at about 40 entries a day.\n' },
        ] },
        { base: ['decision', 1], topic: 'timestamp-trial', ask: verdictAsk('timestamp-trial', 'should stored timestamps be epoch milliseconds or ISO 8601 strings?', 'epoch', 'iso'), variants: [
            { baseVariant: 0, verdict: 'epoch', other: '\\biso\\b', body: 'timestamp trial, 2 weeks\n- ISO 8601 strings: the mobile client sorts stored timestamps as numbers; 2 crashes, both on a string timestamp.\n- Epoch milliseconds: no crashes, sorting correct.\n- Storage size: no meaningful difference.\n' },
            { baseVariant: 1, verdict: '\\biso\\b', other: 'epoch', body: 'timestamp trial, 4 incidents\n- Epoch milliseconds: support read the raw store during 4 incidents and got the time wrong in 3 (seconds taken for milliseconds).\n- ISO 8601 strings: read correctly in all 4.\n- Storage size: no meaningful difference.\n' },
        ] },
        { base: ['do-not', 0], topic: 'legacy-audit', ask: verdictAsk('legacy-audit', 'should src/legacy/ be open to edits during clean-up work, or frozen?', 'open', 'frozen'), variants: [
            { baseVariant: 0, verdict: 'frozen', other: '\\bopen\\b', body: 'legacy audit\n- src/legacy/old-totals.js: imported by a client reconciliation script we cannot see or test.\n- src/legacy/compat.js: 2 v1 clients still call it; the last edit there broke both for a day.\n- Neither file has tests.\n' },
            { baseVariant: 1, verdict: 'frozen', other: '\\bopen\\b', body: 'legacy audit\n- 3 outside integrations import from src/legacy/; none of them is in our test suite.\n- 2 of the last 2 edits under src/legacy/ caused a client incident.\n- The v1 clients are due to be gone next year.\n' },
        ] },
    ],
    accept: ACCEPT,
    F: [
        { file: 'scripts/migrate.mjs', probe: 'Carry on with the migration script in scripts/migrate.mjs.', written: 'migrat', variants: FLIGHT_VARIANTS.map(flightTask('migration script', 'scripts/migrate.mjs')) },
        { file: 'scripts/release.mjs', probe: 'Carry on with the release script in scripts/release.mjs.', written: 'release', variants: FLIGHT_VARIANTS.map(flightTask('release script', 'scripts/release.mjs')) },
        { file: 'scripts/archive.mjs', probe: 'Carry on with the archive job in scripts/archive.mjs.', written: 'archive', variants: FLIGHT_VARIANTS.map(flightTask('archive job', 'scripts/archive.mjs')) },
    ],
    G: [['open-question', 0], ['open-question', 1], ['open-question', 2]],
    H: [['reversed', 0], ['reversed', 1], ['reversed', 2]],
    I: I_RULES,
    J: J_CHAINS.map((chain) => ({
        plants: chain.map((n, i) => J_WORDING[i](n)),
        written: ['\\b' + chain[3] + '\\b', 'quote'], absent: chain.slice(0, 3).map((n) => '\\b' + n + ' days'),
        probe: 'Implement the quote expiry check in src/expiry.js (it is currently a stub).',
        expect: { kind: 'expiry', file: 'src/expiry.js', value: chain[3], earlier: chain.slice(0, 3) },
    })),
    fillers: FILLERS,
};
