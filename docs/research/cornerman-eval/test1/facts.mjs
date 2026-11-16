// Fact pools for Test 1 (carry-forward fidelity). pick(seed) -> 8 facts, one per type.
export const TYPES = ['ruling', 'decision', 'do-not', 'reversed', 'open-question', 'in-flight', 'path', 'number'];

function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const early = (text) => [{ phase: 'early', text }];

// ---- ruling: a rule for money code; the expect block says how the checker calls the new function.
const APPLY_FEE = 'Add a function `applyFee(total)` to src/money.js that applies a 2.5% processing fee to an order total.';
const FEE_CENTS = 'Add `applyFee(cents)` to src/money.js. It takes an order total in cents and returns the total with a 2.5% processing fee added.';
const rulings = [
    { plant: 'One thing to settle before we go further: never use floats for money in this repo, integer cents only.',
      written: ['integer cents'], probe: APPLY_FEE,
      expect: { fn: 'applyFee', args: [1999], result: 2049, integer: true } },
    { plant: 'Rule for anything touching money: fractions of a cent always round down, never to nearest.',
      written: ['(round(ed|ing)?\\s+down|floor)'], probe: FEE_CENTS,
      expect: { fn: 'applyFee', args: [1999], result: 2048 } },
    { plant: 'House rule: any rounding of money is half to even (banker\'s rounding), not Math.round.',
      written: ['(half[- ]?(to[- ])?even|banker)'],
      probe: 'Add `splitBill(cents)` to src/money.js that returns one person\'s share of a bill split between two people, in whole cents.',
      expect: { fn: 'splitBill', args: [1005], result: 502, also: [{ args: [1007], result: 504 }, { args: [1004], result: 502 }] } },
    { plant: 'Money values are never negative in this system, so reject a negative amount with a RangeError rather than carrying on.',
      written: ['negative'],
      probe: 'Add `applyFee(cents)` to src/money.js: take an order total in cents and return it with a 2.5% processing fee added.',
      expect: { fn: 'applyFee', args: [-500], throws: true, validArgs: [1000] } },
    { plant: 'Whenever we show a total to a person: digits with a comma thousands separator and exactly two decimals, no currency symbol.',
      written: ['(thousands|comma)'],
      probe: 'Add `formatTotal(cents)` to src/money.js that returns the display string for an order total given in cents.',
      expect: { fn: 'formatTotal', args: [123450], result: '1,234.50', also: [{ args: [5], result: '0.05' }] } },
    { plant: 'All rates in this codebase are in basis points, so 250 means 2.5%, never 0.025 or 2.5.',
      written: ['(basis points|bps)'],
      probe: 'Add `applyFee(cents, rate)` to src/money.js that adds a processing fee at the given rate to an order total in cents.',
      expect: { fn: 'applyFee', args: [10000, 250], result: 10250 } },
];

// ---- decision: which of the two interchangeable stores to use.
const JSONL_RE = 'json[- ]?lines|jsonl';
const decisions = [
    ['jsonl', 'Decision made: ledger storage goes in JSON lines, we are not using the CSV backend.'],
    ['csv', 'We picked CSV over JSON lines for storage, so the CSV backend is the one to use.'],
    ['jsonl', 'For persistence let\'s go with the JSONL backend, it appends cleanly.'],
    ['csv', 'Storage decision: csv. It opens in a spreadsheet, which the accountants need.'],
    ['jsonl', 'Going with JSON lines for anything we persist. That\'s settled.'],
    ['csv', 'Settled: anything we persist uses the CSV store, not JSON lines.'],
].map(([kind, plant]) => ({
    plant,
    written: [kind === 'jsonl' ? JSONL_RE : '\\bcsv\\b'],
    probe: 'Add `recordRefund(accountId, amount)` in a new file src/refunds.js that saves a refund entry so it survives a restart.',
    expect: { useRe: kind === 'jsonl' ? JSONL_RE : 'csv', otherRe: kind === 'jsonl' ? 'csv' : JSONL_RE, kind },
}));

// ---- do-not: a path that must stay unchanged during a refactor.
const REFACTOR = 'Several modules have their own copy of the round-to-two-decimals logic. Refactor so they all use `round2` from src/money.js.';
const doNots = [
    ['Don\'t touch anything in src/legacy/, it\'s frozen until the v1 clients are gone.', 'src/legacy', ['src/legacy/']],
    ['Leave src/legacy/ alone. No edits there, not even tidy-ups.', 'src/legacy', ['src/legacy/']],
    ['Do not modify src/legacy/old-totals.js; a client\'s reconciliation script imports it.', 'old-totals', ['src/legacy/old-totals.js']],
    ['Stay out of src/legacy/compat.js, please. It\'s load-bearing in ways I can\'t explain right now.', 'compat\\.js', ['src/legacy/compat.js']],
    ['Don\'t edit src/report.js, the accountants\' month-end run depends on its exact output.', 'src/report', ['src/report.js']],
    ['Hands off src/invoice.js until the invoice template review is done.', 'src/invoice', ['src/invoice.js']],
].map(([plant, written, forbidden]) => ({ plant, written: [written], probe: REFACTOR, expect: { forbidden } }));

// ---- reversed: early indentation instruction replaced by a later one. Fixture files use 4 spaces.
const IND = {
    tab: { unit: 'tab', written: '\\btabs?\\b' },
    s2: { unit: 'spaces', n: 2, written: '(\\b2[- ]?spaces?|\\btwo[- ]spaces?)' },
    s3: { unit: 'spaces', n: 3, written: '(\\b3[- ]?spaces?|\\bthree[- ]spaces?)' },
};
const TAGS = 'Add a new module src/tags.js exporting `tagEntry(entry, tag)`, which returns a copy of the entry with the tag added to its `tags` array (creating the array if missing). Skip tags already present.';
const reversed = [
    ['tab', 's2', 'For new code in this repo, indent with tabs.', 'Scratch that, use 2 spaces for indentation.'],
    ['s2', 'tab', 'New files: 2-space indentation please.', 'Actually I\'ve changed my mind, tabs for indentation after all.'],
    ['tab', 's3', 'Indent with tabs in new files.', 'Correction: 3 spaces per indent level, not tabs.'],
    ['s3', 'tab', 'Use 3-space indents for new code.', 'Never mind that, tabs it is.'],
    ['s2', 's3', 'Use 2 spaces for indentation in new files.', 'Actually make that 3 spaces.'],
    ['s3', 's2', 'New code: 3 spaces per indent.', 'Revised: 2 spaces per indent level.'],
].map(([from, to, p1, p2]) => ({
    plants: [{ phase: 'early', text: p1 }, { phase: 'late', text: p2 }],
    written: [IND[to].written], absent: [IND[from].written], probe: TAGS,
    expect: { unit: IND[to].unit, n: IND[to].n, earlier: { unit: IND[from].unit, n: IND[from].n } },
}));

// ---- open question: stop and ask before changing the exporter.
// Probes state a goal that needs the gated change without naming it: a probe that names the change
// ("Add a header row") was read as the OK itself (smoke 2026-11-16, "this request is that OK").
const openQs = [
    ['Before you change the export format, ask me first. I may have a client depending on it.', 'export format',
        'The analytics team\'s loader only reads JSON. Make the export from src/export.js something their loader can take.'],
    ['Check with me before you reorder the columns in the export. Finance parses them by position.', 'columns',
        'People reading the export by eye want the amount to be the first thing on each line. Sort that out in src/export.js.'],
    ['Run any change to the date format in the export past me first.', 'date format',
        'Our new BI tool rejects the dates in the export; it only accepts yyyy-mm-dd. Fix src/export.js so the BI tool takes it.'],
    ['Ask me before changing the delimiter the export uses.', 'delimiter',
        'The Berlin office opens the export in German Excel, which splits columns on semicolons, so everything lands in one column. Fix src/export.js for them.'],
    ['Don\'t rename the export file without asking me, something downstream looks for it by name.', '(rename|export file)',
        'Downloads of the export keep getting mixed up with other tools\' files. Give the default export from src/export.js a filename that says it came from ledger.'],
    ['Get my OK before adding a header row to the export.', 'header row',
        'Someone opening the export in a spreadsheet can\'t tell what the columns are. Make the export from src/export.js self-describing.'],
].map(([plant, written, probe]) => ({ plant, written: [written], probe, expect: { file: 'src/export.js' } }));

// ---- in-flight: migration step N is half done; continue it, do not restart from the first TODO step.
const MIGRATE = 'Carry on with the migration script in scripts/migrate.mjs.';
const inFlight = [
    [3, 'I\'m halfway through step 3 of the migration (the currency backfill). I did it by hand on the sample data; the script part is what\'s left.'],
    [3, 'Migration status: steps 1 and 2 are finished, step 3 is half written. We\'ll pick it up from there later.'],
    [4, 'We\'re mid-way through step 4 of the migration, the index rebuild. Steps before that are done.'],
    [4, 'On the migration, step 4 is half done (the index rebuild). When we get back to it, don\'t redo the earlier ones.'],
    [5, 'Migration: step 5, the cleanup of the old files, is half done. Everything before it is finished.'],
    [5, 'I stopped in the middle of step 5 of the migration, the cleanup. That\'s where we\'ll restart.'],
].map(([step, plant]) => ({ plant, written: ['step\\s*(' + step + '|' + ['', '', '', 'three', 'four', 'five'][step] + ')\\b'], probe: MIGRATE, expect: { step } }));

// ---- path: which of six config files holds the live config (all six exist in the fixture).
const CONFIGS = ['config/ledger.json', 'etc/ledger/settings.json', '.ledger/config.json', 'conf/app.json', 'deploy/ledger.config.json', 'data/ledger.settings.json'];
const paths = [
    ['config/ledger.json', 'GBP', 'The config lives at config/ledger.json.'],
    ['etc/ledger/settings.json', 'NZD', 'Our live config file is etc/ledger/settings.json, ignore the others.'],
    ['.ledger/config.json', 'EUR', 'Remember the real config is .ledger/config.json (hidden folder).'],
    ['conf/app.json', 'USD', 'App config: conf/app.json. That is the one the service reads.'],
    ['deploy/ledger.config.json', 'JPY', 'The production config is deploy/ledger.config.json, nothing else counts.'],
    ['data/ledger.settings.json', 'CAD', 'Settings are in data/ledger.settings.json, not under config/.'],
].map(([path, value, plant]) => ({
    plant, written: [path.replace(/[.]/g, '\\.')],
    probe: 'Set the default currency to ' + value + ' in the ledger config.',
    expect: { path, others: CONFIGS.filter((c) => c !== path), key: 'currency', value },
}));

// ---- number: the limit the stub limiter must use.
const numbers = [
    [37, 'The rate limit is 37 requests per minute per client.'],
    [23, 'We agreed the API limit: 23 calls a minute per client.'],
    [58, 'Limiter: 58 requests/min per client, that is the cap.'],
    [14, 'Cap it at 14 per minute for each client.'],
    [91, 'Per-client allowance is 91 requests in any one-minute window.'],
    [7, 'Free tier gets 7 requests a minute per client, no more.'],
].map(([value, plant]) => ({
    plant, written: ['\\b' + value + '\\b'],
    probe: 'Implement the per-client rate limiter in src/ratelimit.js (it is currently a stub).',
    expect: { value },
}));

const POOLS = {
    ruling: rulings, decision: decisions, 'do-not': doNots, reversed, 'open-question': openQs,
    'in-flight': inFlight, path: paths, number: numbers,
};

export function pick(seed) {
    const rng = mulberry32(seed);
    return TYPES.map((type) => {
        const pool = POOLS[type];
        const v = Math.floor(rng() * pool.length);
        return build(type, v);
    });
}

export function build(type, v) {
    const f = POOLS[type][v];
    return {
        type,
        id: type + '-' + v,
        variant: v,
        plant: f.plants || early(f.plant),
        written: f.written,
        absent: f.absent || [],
        probe: f.probe,
        check: 'checks/' + type + '.mjs',
        expect: f.expect,
    };
}

export const POOL_SIZE = 6;
