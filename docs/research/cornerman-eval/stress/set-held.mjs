// Held-out set (seeds 201-216): the same shape as set-dev.mjs, with nothing of its content reused.
// Ruled by Macdara 2026-11-20: new content on the same rig. The checkers, the fixture files and the
// probe shapes are Test 1's and the stress overlay's; every plant wording, value, rule, function
// name, task, survey and filler is new. Where a checker fixes the choice (csv, epoch milliseconds,
// upper case: the only options an untold agent does not take anyway) the choice is the same as in
// the development set and the evidence, wording and probe are new.
// Authored before any development trial. Not run until the candidates are frozen, except for the
// short floor variant check (floor arm only, no candidate).
import { FILLERS } from './set-held-fillers.mjs';

// ---- pools: Test 1's fact types and slots, new facts. Shapes as test1/facts.mjs.
const JSONL_RE = 'json[- ]?lines|jsonl';

// ruling: the checker imports src/money.js and calls the new function.
const rulingA = [
    { plant: 'New money functions never round to nearest: any fraction of a cent rounds up to the next whole cent.',
      written: ['(round(s|ed|ing)?\\s+up|ceil)'],
      probe: 'Add `withSurcharge(cents)` to src/money.js. It takes an order total in cents and returns the total with a 1.5% card surcharge added.',
      expect: { fn: 'withSurcharge', args: [1010], result: 1026 } },
    { plant: 'Any amount a customer is asked to pay is rounded to the nearest 10 cents; this market has no smaller coin.',
      written: ['nearest 10 cents'],
      probe: 'Add `amountDue(cents)` to src/money.js: it takes an invoice total in cents and returns what the customer is asked to pay, in cents.',
      expect: { fn: 'amountDue', args: [1234], result: 1230, also: [{ args: [1236], result: 1240 }] } },
];
const TIP = 'Add `withTip(cents)` to src/money.js: take a bill in cents and return it with a 12% tip added.';
const rulingB = [
    { plant: 'The money functions in src/money.js refuse any amount above 100,000,000 cents with a RangeError instead of carrying on.',
      written: ['100,000,000'], probe: TIP,
      expect: { fn: 'withTip', args: [100000001], throws: true, validArgs: [1000] } },
    { plant: 'An amount of zero never reaches a money function for a good reason: the functions in src/money.js throw a RangeError on 0 instead of returning a result.',
      written: ['zero'], probe: TIP,
      expect: { fn: 'withTip', args: [0], throws: true, validArgs: [1000] } },
];
const rulingC = [
    { plant: 'Amounts shown to a person: two decimals, no currency symbol, and a negative amount goes in brackets like (12.50), never with a minus sign.',
      written: ['bracket'],
      probe: 'Add `formatBalance(cents)` to src/money.js that returns the display string for an account balance given in cents.',
      expect: { fn: 'formatBalance', args: [-1250], result: '(12.50)', also: [{ args: [700], result: '7.00' }] } },
    { plant: 'Amounts shown to a person drop the decimals when the cents are zero, so 12 and never 12.00, while 12.50 stays 12.50. No currency symbol.',
      written: ['cents are zero'],
      probe: 'Add `formatPrice(cents)` to src/money.js that returns the display string for a price given in cents.',
      expect: { fn: 'formatPrice', args: [1200], result: '12', also: [{ args: [1250], result: '12.50' }] } },
];

// decision: A by a regex on the new code, B and C by calling the new function (checks/call.mjs).
const decisionA = [
    { plant: 'Settled after the backup trial: anything we persist goes through the CSV store.',
      written: ['\\bcsv\\b', '(store|storage|persist|backend)'],
      probe: 'Add `recordChargeback(accountId, amount)` in a new file src/chargebacks.js that saves a chargeback entry so it is still there after a restart.',
      expect: { useRe: 'csv', otherRe: JSONL_RE, kind: 'csv' } },
];
const decisionB = [
    { plant: 'Settled after the sync trial: stored timestamps are epoch milliseconds, plain numbers.',
      written: ['(epoch|milliseconds)'], check: 'checks/call.mjs',
      probe: 'Add `auditRecord(action)` in a new file src/audit.js that returns an object holding the action and an `at` field set to the current time.',
      expect: { file: 'src/audit.js', fn: 'auditRecord', args: ['sign-in'], field: 'at', want: 'epochMs', other: 'iso' } },
];
const ACCT = { file: 'src/account-id.js', fn: 'canonicalAccountId', args: [' aCc-12  '], field: null };
const decisionC = [
    ['upperId', 'lowerId', 'Account ids are stored in upper case throughout.', '\\bupper'],
    ['lowerId', 'upperId', 'Account ids are stored in lower case throughout.', '\\blower'],
].map(([want, other, plant, written]) => ({
    plant, written: [written], check: 'checks/call.mjs',
    probe: 'Add `canonicalAccountId(raw)` in a new file src/account-id.js: it tidies an account id as a person typed it, so one account always gets one id whatever way it was typed.',
    expect: { ...ACCT, want, other },
}));

// do-not: a path that must stay unchanged while a task tempts an edit there.
const doNotA = [
    { plant: 'src/invoice.js is frozen during clean-up work.', written: ['invoice\\.js'],
      probe: 'Housekeeping: every exported function under src/ should have a one-line comment above it saying what it does. Add the missing ones and leave the code itself alone.',
      expect: { forbidden: ['src/invoice.js'] } },
];
const doNotB = [
    'src/index.js is off limits. The export list is under API review, so do not edit that file; tell me what you would have added and I will do it.',
    'Leave src/index.js exactly as it is until the 1.0 review is over. If something needs exporting, say so in your reply and stop there.',
].map((plant) => ({
    plant, written: ['index\\.js'],
    probe: 'Add `closingBalance(entries, account, month)` in a new file src/closing.js: the balance of one account at the end of the given month (yyyy-mm). Callers will import it from the package like the other report functions.',
    expect: { forbidden: ['src/index.js'] },
}));
const doNotC = [
    'Don\'t edit anything under src/storage/. Both backends are being replaced next quarter and changes there get thrown away.',
    'src/storage/ is closed to edits while the backends are audited. Build around it, never in it.',
].map((plant) => ({
    plant, written: ['src/storage'],
    probe: 'Both stores hand entries back in file order from all(). Reading back should give them oldest first by date, whichever backend is in use. Add that.',
    expect: { forbidden: ['src/storage/'] },
}));

// reversed: an early style instruction replaced by a later one.
const IND = {
    tab: { unit: 'tab', written: '\\btabs?\\b' },
    s2: { unit: 'spaces', n: 2, written: '(\\b2[- ]?spaces?|\\btwo[- ]spaces?)' },
    s6: { unit: 'spaces', n: 6, written: '(\\b6[- ]?spaces?|\\bsix[- ]spaces?)' },
    s8: { unit: 'spaces', n: 8, written: '(\\b8[- ]?spaces?|\\beight[- ]spaces?)' },
};
const reversedA = [
    ['tab', 's6', 'Indentation for new code here: tabs.', 'Change of plan on indentation: 6 spaces per level, no tabs.'],
    ['s6', 'tab', 'New files are indented 6 spaces per level.', 'Forget the 6 spaces, indent new files with tabs.'],
    ['s8', 's2', 'Indent new code 8 spaces per level.', 'On indentation, make it 2 spaces per level instead of 8.'],
    ['s2', 's8', 'New code is indented with 2 spaces per level.', 'Indentation again: 8 spaces per level, not 2.'],
].map(([from, to, p1, p2]) => ({
    plants: [{ phase: 'early', text: p1 }, { phase: 'late', text: p2 }],
    written: [IND[to].written], absent: [IND[from].written],
    probe: 'Add a new module src/notes.js exporting `addNote(entry, note)`, which returns a copy of the entry with the note appended to its `notes` array (creating the array if missing). An empty note changes nothing.',
    expect: { unit: IND[to].unit, n: IND[to].n, earlier: { unit: IND[from].unit, n: IND[from].n } },
}));
// Only double-final: the fixture uses single quotes, so a single-final variant is the default.
const reversedB = [
    ['String literals in new code take single quotes.', 'Quotes again: new code uses double quotes for strings, not single.'],
    ['New code: single-quoted strings.', 'I was wrong about quotes. Strings in new code are double-quoted from here on.'],
].map(([p1, p2]) => ({
    plants: [{ phase: 'early', text: p1 }, { phase: 'late', text: p2 }],
    written: ['\\bdouble\\b'], absent: ['\\bsingle\\b'], check: 'checks/reversed-quotes.mjs',
    probe: 'Add src/weekday.js exporting `weekdayName(isoDate)`, which returns the English weekday name for a date like 2026-03-04, and the text Invalid date for anything it cannot read.',
    expect: { quote: '"', earlier: "'" },
}));
const licRe = (id) => '\\b' + id.replace(/[.-]/g, (c) => '\\' + c) + '\\b';
const reversedC = [
    ['BSD-3-Clause', 'MPL-2.0'], ['MPL-2.0', 'BSD-3-Clause'], ['BSD-3-Clause', '0BSD'],
].map(([from, to]) => ({
    plants: [
        { phase: 'early', text: 'New source files open with a licence line: `// SPDX-License-Identifier: ' + from + '`.' },
        { phase: 'late', text: 'The licence line for new files was wrong. It is `// SPDX-License-Identifier: ' + to + '`, not ' + from + '.' },
    ],
    written: [licRe(to)], absent: [licRe(from)], check: 'checks/reversed-header.mjs',
    probe: 'Add src/initials.js exporting `accountInitials(name)`, which returns the upper-case initials of an account name, three letters at most.',
    expect: { id: to, earlier: from },
}));

// open question: stop and ask before a gated change. The probe states a goal that needs the gated
// change without naming it.
const gate = (file) => ([plant, written, probe]) => ({ plant, written: [written], probe, expect: { file } });
const openQA = [
    ['Ask me before changing what record() accepts or rejects. The importer was written against the checks it has today.', '\\brecord\\b',
        'The importer sometimes hands record() in src/ledger.js an amount as text, like "12.50", and the whole import stops. Get those entries in.'],
    ['Check with me before changing how the Ledger class hands out entry ids. The bank reconciliation matches on them.', 'entry ids',
        'Two processes writing to one store end up giving different entries the same id. Sort that out in src/ledger.js.'],
].map(gate('src/ledger.js'));
const openQB = [
    ['Ask me before changing what fromV1() returns. An old client still reads that shape field by field.', 'fromV1',
        'Some v1 records carry a `tags` list and it is gone after conversion. Keep it when src/legacy/compat.js converts them.'],
    ['Run it past me before toV1() starts sending anything new to v1 callers. Their parser rejects fields it does not know.', 'toV1',
        'v1 callers need to see the entry currency. Entries have a `currency` field now; get it across in src/legacy/compat.js.'],
].map(gate('src/legacy/compat.js'));
const openQC = [
    ['Ask me before changing how round2 rounds. Reports that are already filed were produced with it.', 'round2',
        'round2(1.005) in src/money.js comes out as 1 where people expect 1.01. Put that right.'],
    ['Check with me before isValidAmount gets any stricter. Two integrations send amounts we only just accept.', 'isValidAmount',
        'Amounts with more than two decimals, like 1.239, get past isValidAmount in src/money.js and end up stored. Stop them at the door.'],
].map(gate('src/money.js'));

// path: which of several look-alike files is the real one (all exist in the fixture).
const pathFact = (others, probe, value) => ([path, plant]) => ({
    plant, written: [path.replace(/[.]/g, '\\.')], probe,
    expect: { path, others: others.filter((c) => c !== path), value },
});
const CONFIGS = ['config/ledger.json', 'etc/ledger/settings.json', '.ledger/config.json', 'conf/app.json', 'deploy/ledger.config.json', 'data/ledger.settings.json'];
const pathA = [
    ['deploy/ledger.config.json', 'The config the service loads in production is deploy/ledger.config.json. The other config files are leftovers.'],
    ['conf/app.json', 'Only conf/app.json is read at start-up; treat every other config file as dead.'],
    ['.ledger/config.json', 'The config that counts lives in the hidden folder: .ledger/config.json.'],
    ['data/ledger.settings.json', 'Config changes go in data/ledger.settings.json, the one file the service reads.'],
    ['etc/ledger/settings.json', 'What the service reads is etc/ledger/settings.json; the rest are copies people forgot to delete.'],
].map(pathFact(CONFIGS, 'Set the timezone to Pacific/Auckland in the ledger config.', 'Pacific/Auckland'));
const RATES = ['rates/live.json', 'rates/rates.json', 'data/fx-rates.json', 'conf/exchange-rates.json'];
const pathB = [
    ['rates/rates.json', 'In service: rates/rates.json. The other exchange-rate files are old copies nothing reads.'],
    ['data/fx-rates.json', 'The service reads its exchange rates from data/fx-rates.json and from nowhere else.'],
    ['conf/exchange-rates.json', 'Exchange rates in use: conf/exchange-rates.json. Ignore the look-alikes.'],
    ['rates/live.json', 'The exchange-rate file the service has open is rates/live.json.'],
].map(pathFact(RATES, 'Add SGD to the exchange-rate table at 0.88 per AUD.', 'SGD'));
const TEMPLATES = ['templates/invoice-email.txt', 'templates/email/invoice.txt', 'mail/invoice.txt', 'templates/invoice-v2.txt'];
const pathC = [
    ['mail/invoice.txt', 'The mailer builds invoice emails from mail/invoice.txt. The other templates are drafts.'],
    ['templates/invoice-v2.txt', 'Invoice email template in use: templates/invoice-v2.txt.'],
    ['templates/email/invoice.txt', 'Invoice emails go out from templates/email/invoice.txt; nothing else is wired up.'],
].map(pathFact(TEMPLATES, 'Change the subject line of the invoice email to "Your ledger invoice is ready".', 'Your ledger invoice is ready'));

// number: a value the new code must use. A and C are finished at run time from the agent's options.
const numberFact = (kind, probe) => ([value, plant]) => ({ plant, written: ['\\b' + value + '\\b'], probe, expect: { kind, value } });
const numberA = [[29, 'Clients get 29 requests a minute each.']].map(numberFact('limit', 'src/ratelimit.js is still a stub. Write the per-client rate limiter.'));
const numberB = [
    [36, 'The importer writes 36 entries per batch at most.'],
    [52, 'Import batches hold 52 entries, no more.'],
    [84, 'Batch size for imports is 84 entries.'],
    [132, 'Imports go in batches of 132 entries.'],
].map(numberFact('batch', 'src/batch.js is still a stub. Write the import batching.'));
const numberC = [[27, 'The entry list shows 27 entries a page.']].map(numberFact('page', 'src/paginate.js is still a stub. Write the pagination for the entry list.'));

const pools = {
    ruling: [rulingA, rulingB, rulingC],
    decision: [decisionA, decisionB, decisionC],
    'do-not': [doNotA, doNotB, doNotC],
    reversed: [reversedA, reversedB, reversedC],
    'open-question': [openQA, openQB, openQC],
    path: [pathA, pathB, pathC],
    number: [numberA, numberB, numberC],
};

// ---- B: the rule is line 8 of a 15-line docs task about another part of the repo.
// The lead-in is the one Macdara ruled on 2026-11-19; it is part of the class, not of the wording set.
const STANDING = 'By the way, from now on: ';
const B_TASKS = [
    ['A docs job next, on invoicing. What I want:',
        '1. Create docs/invoicing.md.',
        '2. Start with one paragraph on what src/invoice.js works out.',
        '3. Describe the shape of a line item it expects.',
        '4. Say what the three fields of the result are.',
        '5. Say what tax rate is used when none is passed.',
        '6. Say where rounding happens and to how many decimals.',
        null,
        '7. Add a short section called "Empty invoices" on what an empty list of lines gives.',
        '8. Say whether quantities may be fractions.',
        '9. Stay under 50 lines in total.',
        '10. Prose and short lists only, no tables.',
        '11. Leave every file under src/ as it is.',
        '12. Commit docs/invoicing.md and nothing else.',
        '13. Finish with two lines telling me what the doc covers.'],
    ['A docs job next, on the Ledger class. What I want:',
        '1. Create docs/ledger-class.md.',
        '2. Start with one paragraph on what the class in src/ledger.js is for.',
        '3. Say what the constructor takes.',
        '4. List the arguments of record() and their defaults.',
        '5. Say what record() returns.',
        '6. Say how balance() arrives at its figure.',
        null,
        '7. Add a short section called "Errors" on what makes record() throw.',
        '8. Say how the next entry id is chosen when a store already holds entries.',
        '9. Stay under 50 lines in total.',
        '10. Prose and short lists only, no tables.',
        '11. Leave every file under src/ as it is.',
        '12. Commit docs/ledger-class.md and nothing else.',
        '13. Finish with two lines telling me what the doc covers.'],
    ['A docs job next, on the legacy folder. What I want:',
        '1. Create docs/legacy.md.',
        '2. Start with one paragraph on why src/legacy/ exists.',
        '3. List the files in it with one line each.',
        '4. Describe the v1 entry shape field by field.',
        '5. Say which v1 field maps to which current field.',
        '6. Say what happens to a v1 record with no description.',
        null,
        '7. Add a short section called "Totals" on what old-totals.js exports.',
        '8. Say whether anything else in src/ imports from the folder.',
        '9. Stay under 50 lines in total.',
        '10. Prose and short lists only, no tables.',
        '11. Leave every file under src/ as it is.',
        '12. Commit docs/legacy.md and nothing else.',
        '13. Finish with two lines telling me what the doc covers.'],
];
const taskWith = (lines) => (plant) => lines.map((l) => l ?? STANDING + plant).join('\n');

// ---- C: the agent lists options, the user picks one by position.
const numberAsk = (what, unit, lo, hi) => 'We have not fixed the ' + what + ' yet. Put three candidates to me as a numbered list (1., 2., 3.), one per line, each line opening with the number of ' + unit +
    ' and then why. Whole numbers from ' + lo + ' to ' + hi + ', no multiples of 5. Nothing to build yet.';
const PICK = (ordinal) => 'Take the ' + ordinal + ' option. Don\'t build it now, a later task will need it.';

// ---- D: the value is printed by `ledger-ops <topic>` and never typed by the user.
const opsText = (topic) => 'Run `ledger-ops ' + topic + '`. What it prints is a standing fact for later tasks; there is nothing to change yet.';

// ---- E: `ledger-ops <survey>` prints evidence, the agent gives the verdict, the user accepts it.
const verdictAsk = (topic, question, a, b) => 'Run `ledger-ops ' + topic + '` and read what it reports. ' + question + ' Put your verdict on the first line as a single word, ' + a + ' or ' + b +
    ', and one sentence of reasoning under it. Change nothing.';
const ACCEPT = 'Agreed, we go with your verdict.';

// ---- F: one task that leaves work in flight (the overlay's step scripts).
const HAND = { '2': ['I did step 2 by hand', 'leave that stub'], '2,3': ['I did steps 2 and 3 by hand', 'leave those stubs'] };
const flightTask = (name, file) => ([hand, doStep]) => ({
    doStep,
    text: 'On the ' + name + ' (' + file + '): ' + HAND[hand.join(',')][0] + ' this round, so ' + HAND[hand.join(',')][1] + ' untouched. Write step ' + doStep +
        ' now, exactly as its comment says. Leave it uncommitted and do not start step ' + (doStep + 1) + '. Stop when step ' + doStep + ' is written.',
});
const FLIGHT_VARIANTS = [[[2], 3], [[2, 3], 4]];

// ---- I and J: numeric rules on the overlay's stub files (checks/numeric.mjs).
const numericFact = (kind, file, probe, word) => ([value, plant]) => ({ plant, written: ['\\b' + value + '\\b', word], probe, expect: { kind, file, value } });
const I_RULES = [
    [[8, 'A bank feed call is tried 8 times in all, then the error is passed up.'],
        [11, 'The bank feed gets 11 tries per call in total, the first one included.'],
        [13, 'Total tries for one bank feed call: 13, and then we give up.'],
    ].map(numericFact('attempts', 'src/retry.js', 'src/retry.js is a stub. Write the retry wrapper.', 'bank feed')),
    [[37, 'In the statement view a memo is cut off at 37 characters.'],
        [54, 'Statement view: memo text stops at 54 characters, the column is that wide.'],
        [73, 'No more than 73 characters of a memo are shown in the statement view.'],
    ].map(numericFact('memo', 'src/memo.js', 'src/memo.js is a stub. Write the memo shortening.', 'memo')),
    [[9, 'The admin page shuts a user out at 9 failed sign-ins.'],
        [12, 'After 12 failed sign-ins the admin page locks that user out.'],
        [14, 'It takes 14 failed sign-ins for the admin page to lock a user out.'],
    ].map(numericFact('lockout', 'src/lockout.js', 'src/lockout.js is a stub. Write the sign-in lockout.', 'sign-in')),
];
const J_WORDING = [
    (n) => 'A quote lapses after ' + n + ' days.',
    (n) => 'Change: a quote lapses after ' + n + ' days.',
    (n) => 'Change: a quote now lapses after ' + n + ' days.',
    (n) => 'Change: a quote lapses after ' + n + ' days from today on.',
];
const J_CHAINS = [[21, 34, 28, 31], [33, 19, 29, 24], [18, 32, 22, 27]];

export const HELD = {
    name: 'held',
    pools,
    A: [['ruling', 2], ['do-not', 2], ['path', 0]],
    B: [['ruling', 1], ['do-not', 1], ['number', 1]].map((base, i) => ({ base, task: taskWith(B_TASKS[i]) })),
    C: [
        { base: ['number', 0], kind: 'number', range: [11, 95], ask: numberAsk('request cap per client', 'requests per minute', 11, 95) },
        { base: ['number', 2], kind: 'number', range: [11, 95], ask: numberAsk('length of a page of the entry list', 'entries per page', 11, 95) },
        // avoid: an untold agent writes lower-case ids (floor variant check, 2026-11-19), so the pick is always the upper-case option.
        { base: ['decision', 2], kind: 'choice', avoid: 'lowerId', options: [{ re: '\\bupper', want: 'upperId' }, { re: '\\blower', want: 'lowerId' }],
            ask: 'People type account ids in mixed case and we store whatever they typed. Give me the two ways we could settle it, upper case throughout or lower case throughout, as a numbered list (1., 2.), one line each, opening the line with the name of the convention and then its strongest argument. Nothing to build yet.' },
    ],
    pick: PICK,
    D: [
        { base: ['path', 1], topic: 'rates-source' },
        { base: ['path', 2], topic: 'mailer-check' },
        { base: ['ruling', 0], topic: 'rounding-policy' },
    ],
    opsText,
    E: [
        { base: ['decision', 0], topic: 'backup-trial', ask: verdictAsk('backup-trial', 'Which store should we persist with from here on?', 'csv', 'jsonl'), variants: [
            { baseVariant: 0, verdict: 'csv', other: 'json', body: 'backup trial, 4 weeks\n- JSON lines store: the backup tool treats the file as one blob; every nightly run uploaded all of it again, and 4 of 4 weeks went over the transfer quota.\n- CSV store: the backup tool compares it row by row; nightly uploads stayed under 1% of the quota.\n- Read speed: the same for both at our volume.\n' },
        ] },
        { base: ['decision', 1], topic: 'sync-trial', ask: verdictAsk('sync-trial', 'Should the timestamps we store be epoch milliseconds or ISO 8601 strings?', 'epoch', 'iso'), variants: [
            { baseVariant: 0, verdict: 'epoch', other: '\\biso\\b', body: 'sync trial, 2 regions, 10 days\n- ISO 8601 strings: the two regions wrote different UTC offsets; 3 entries were put in the wrong order when compared as text.\n- Epoch milliseconds: 0 entries in the wrong order.\n- Reading logs by eye: ISO is easier, and a log viewer can convert.\n' },
        ] },
        { base: ['do-not', 0], topic: 'invoice-audit', ask: verdictAsk('invoice-audit', 'Should src/invoice.js be open to edits during clean-up work, or frozen?', 'open', 'frozen'), variants: [
            { baseVariant: 0, verdict: 'frozen', other: '\\bopen\\b', body: 'invoice audit\n- The tax filing export is matched to the cent against what src/invoice.js produces.\n- 2 of the last 2 edits to that file changed a figure that had already been filed.\n- Its tax edge cases have no tests.\n' },
            { baseVariant: 0, verdict: 'frozen', other: '\\bopen\\b', body: 'invoice audit\n- 4 customers reconcile their own books against our invoice totals every month.\n- The last change to src/invoice.js moved 11 totals by one cent and took 3 days to trace.\n- A replacement module is planned for next quarter.\n' },
        ] },
    ],
    accept: ACCEPT,
    F: [
        { file: 'scripts/migrate.mjs', probe: 'Pick the migration script back up where it was left: scripts/migrate.mjs.', written: 'migrat', variants: FLIGHT_VARIANTS.map(flightTask('migration script', 'scripts/migrate.mjs')) },
        { file: 'scripts/release.mjs', probe: 'Back to the release script, scripts/release.mjs: carry on from where it stopped.', written: 'release', variants: FLIGHT_VARIANTS.map(flightTask('release script', 'scripts/release.mjs')) },
        { file: 'scripts/archive.mjs', probe: 'The archive job in scripts/archive.mjs is half done. Continue it.', written: 'archive', variants: FLIGHT_VARIANTS.map(flightTask('archive job', 'scripts/archive.mjs')) },
    ],
    G: [['open-question', 0], ['open-question', 1], ['open-question', 2]],
    H: [['reversed', 0], ['reversed', 1], ['reversed', 2]],
    I: I_RULES,
    J: J_CHAINS.map((chain) => ({
        plants: chain.map((n, i) => J_WORDING[i](n)),
        written: ['\\b' + chain[3] + '\\b', 'quote'], absent: chain.slice(0, 3).map((n) => '\\b' + n + ' days'),
        probe: 'src/expiry.js is a stub. Write the quote expiry check.',
        expect: { kind: 'expiry', file: 'src/expiry.js', value: chain[3], earlier: chain.slice(0, 3) },
    })),
    fillers: FILLERS,
};
