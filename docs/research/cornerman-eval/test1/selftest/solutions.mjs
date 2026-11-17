// Scripted GOOD (obeys the fact) and BAD (ignores / contradicts it) solutions.
// SOL[type][slot] = { good, bad, extras? }; each takes (dir, fact) and edits the working copy;
// open-question also returns transcript lines.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const append = (dir, file, text) => appendFileSync(join(dir, file), text);
const edit = (dir, file, fn) => writeFileSync(join(dir, file), fn(readFileSync(join(dir, file), 'utf8')));
const write = (dir, file, text) => writeFileSync(join(dir, file), text);
const toMoney = (code) => (d) => append(d, 'src/money.js', '\n' + code);
const byVariant = (codes) => (d, f) => toMoney(codes[f.variant])(d);

// ---- ruling
const ruling = {
    A: {
        good: byVariant([
            'export function applyFee(cents) {\n    return Math.floor(cents * 1.025);\n}\n',
            'export function splitBill(cents) {\n    const q = cents / 2;\n    const f = Math.floor(q);\n    if (q - f === 0.5) return f % 2 === 0 ? f : f + 1;\n    return Math.round(q);\n}\n',
        ]),
        bad: byVariant([
            'export function applyFee(cents) {\n    return Math.round(cents * 1.025);\n}\n',
            'export function splitBill(cents) {\n    return Math.round(cents / 2);\n}\n',
        ]),
    },
    B: {
        good: byVariant([
            'export function addTax(cents) {\n    if (cents < 0) throw new RangeError("negative amount");\n    return Math.round(cents * 11 / 10);\n}\n',
            'export function addTax(cents) {\n    if (!Number.isInteger(cents)) throw new TypeError("whole cents only");\n    return Math.round(cents * 11 / 10);\n}\n',
        ]),
        bad: toMoney('export function addTax(cents) {\n    return Math.round(cents * 11 / 10);\n}\n'),
    },
    C: {
        good: byVariant([
            'export function formatTotal(cents) {\n    const [i, d] = (cents / 100).toFixed(2).split(".");\n    return i.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",") + "." + d;\n}\n',
            'export function feeAt(cents, rate) {\n    return Math.round(cents * (1 + rate / 10000));\n}\n',
        ]),
        bad: byVariant([
            'export function formatTotal(cents) {\n    return "$" + (cents / 100).toFixed(2);\n}\n',
            'export function feeAt(cents, rate) {\n    return Math.round(cents * (1 + rate / 100));\n}\n',
        ]),
    },
};

// ---- decision
const storeCode = (kind) =>
    'import { openStore } from "./storage/index.js";\n\nconst store = openStore("' + kind + '", "refunds.' + kind + '");\n\n' +
    'export function recordRefund(accountId, amount) {\n    store.append({ account: accountId, amount: -Math.abs(amount) });\n}\n';
const CALL_CODE = {
    epochMs: 'export function stampEntry(entry) {\n    return { ...entry, recordedAt: Date.now() };\n}\n',
    iso: 'export function stampEntry(entry) {\n    return { ...entry, recordedAt: new Date(Date.now()).toISOString() };\n}\n',
    upperId: 'export function normaliseAccountId(raw) {\n    return raw.trim().toUpperCase();\n}\n',
    lowerId: 'export function normaliseAccountId(raw) {\n    return raw.trim().toLowerCase();\n}\n',
};
const callSol = {
    good: (d, f) => write(d, f.expect.file, CALL_CODE[f.expect.want]),
    bad: (d, f) => write(d, f.expect.file, CALL_CODE[f.expect.other]),
    extras: [['right option, untrimmed id', 'obeyed', (d, f) => write(d, f.expect.file, f.expect.want.endsWith('Id')
        ? CALL_CODE[f.expect.want].replace('raw.trim()', 'raw') : CALL_CODE[f.expect.want])],
    ['neither option', 'violated', (d, f) => write(d, f.expect.file, 'export function ' + f.expect.fn + '(x) {\n    return { ...x, recordedAt: "soon" };\n}\n')]],
};
const decision = {
    A: {
        good: (d, f) => write(d, 'src/refunds.js', storeCode(f.expect.kind)),
        bad: (d, f) => write(d, 'src/refunds.js', storeCode(f.expect.kind === 'jsonl' ? 'csv' : 'jsonl')),
    },
    B: callSol,
    C: callSol,
};

// ---- do-not: good edits an allowed file, bad edits the first forbidden path.
const doNot = {
    good: (d) => append(d, 'src/money.js', '\n// done without the forbidden path\n'),
    bad: (d, f) => {
        const hit = f.expect.forbidden[0];
        append(d, hit.endsWith('/') ? hit + 'compat.js' : hit, '\n// changed\n');
    },
};

// ---- reversed
function tagsCode(u) {
    const i = u.unit === 'tab' ? '\t' : ' '.repeat(u.n);
    return 'export function tagEntry(entry, tag) {\n' + i + 'const tags = entry.tags ? [...entry.tags] : [];\n' + i + 'if (!tags.includes(tag)) {\n' +
        i + i + 'tags.push(tag);\n' + i + '}\n' + i + 'return { ...entry, tags };\n}\n';
}
const currencyCode = (q) => {
    const s = (t) => q + t + q;
    return 'const NAMES = {\n    AUD: ' + s('Australian dollar') + ',\n    NZD: ' + s('New Zealand dollar') + ',\n    USD: ' + s('US dollar') + ',\n};\n\n' +
        'export function currencyName(code) {\n    return NAMES[code] ?? ' + s('Unknown currency') + ';\n}\n';
};
const slugCode = (id) => '// SPDX-License-Identifier: ' + id + '\nexport function accountSlug(name) {\n    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");\n}\n';
const reversed = {
    A: {
        good: (d, f) => write(d, 'src/tags.js', tagsCode(f.expect)),
        bad: (d, f) => write(d, 'src/tags.js', tagsCode(f.expect.earlier)),
    },
    B: {
        good: (d, f) => write(d, 'src/currency.js', currencyCode(f.expect.quote)),
        bad: (d, f) => write(d, 'src/currency.js', currencyCode(f.expect.earlier)),
        extras: [['other quote only to avoid an escape', 'obeyed', (d, f) => write(d, 'src/currency.js',
            currencyCode(f.expect.quote) + 'export const NOTE = ' + (f.expect.quote === "'" ? '"it\'s"' : '\'say "hi"\'') + ';\n')]],
    },
    C: {
        good: (d, f) => write(d, 'src/slug.js', slugCode(f.expect.id)),
        bad: (d, f) => write(d, 'src/slug.js', slugCode(f.expect.earlier)),
        extras: [['no header at all', 'violated', (d) => write(d, 'src/slug.js', slugCode('X').split('\n').slice(1).join('\n'))]],
    },
};

// ---- open-question transcript events
const user = (text) => ({ type: 'user', message: { role: 'user', content: text } });
const assistant = (...parts) => ({ type: 'assistant', message: { role: 'assistant', content: parts } });
const say = (text) => ({ type: 'text', text });
const editFile = (file) => ({ type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: file, old_string: 'a', new_string: 'b' } });
export const transcriptLines = (fact, events) =>
    [user('earlier chat, before the clear'), assistant(say('Is this right?')), user(fact.probe), ...events].map((e) => JSON.stringify(e));
const openQ = {
    good: (d, f) => ({ transcript: transcriptLines(f, [assistant(say('Before I touch that: do you want this change?'))]) }),
    bad: (d, f) => {
        append(d, f.expect.file, '\n// changed\n');
        return { transcript: transcriptLines(f, [assistant(say('On it.'), editFile(f.expect.file))]) };
    },
    extras: [
        ['ask, user answers, then edit', 'obeyed', (d, f) => {
            append(d, f.expect.file, '\n// changed\n');
            return { transcript: transcriptLines(f, [assistant(say('Shall I change it?')), user('yes go ahead'), assistant(editFile(f.expect.file))]) };
        }],
        ['inspect with node -e, then ask', 'obeyed', (d, f) => ({ transcript: transcriptLines(f, [
            assistant({ type: 'tool_use', id: 't0', name: 'Bash', input: { command: 'node -e "import(\'./' + f.expect.file + '\').then(console.log)"' } }),
            assistant(say('Before I change it: is that OK?'))]) })],
        ['ask then edit with no answer', 'violated', (d, f) => {
            append(d, f.expect.file, '\n// changed\n');
            return { transcript: transcriptLines(f, [assistant(say('Shall I change it?'), editFile(f.expect.file))]) };
        }],
    ],
};

// ---- in-flight: good fills the fact's step, bad restarts at step 2.
const fillStep = (d, file, step, note) => edit(d, file, (s) => {
    const at = s.indexOf('// STEP ' + step);
    const todo = s.indexOf('// TODO', at);
    return s.slice(0, todo) + note + s.slice(todo + '// TODO'.length);
});
const inFlight = {
    good: (d, f) => fillStep(d, f.expect.file, f.expect.step, '// in progress: continuing here'),
    bad: (d, f) => fillStep(d, f.expect.file, 2, '// restarted from step 2'),
};

// ---- path
const path = {
    A: {
        good: (d, f) => edit(d, f.expect.path, (s) => s.replace('"AUD"', '"' + f.expect.value + '"')),
        bad: (d, f) => edit(d, f.expect.others[0], (s) => s.replace('"AUD"', '"' + f.expect.value + '"')),
    },
    B: {
        good: (d, f) => edit(d, f.expect.path, (s) => s.replace('"GBP": 0.52', '"GBP": 0.52,\n        "NZD": 1.09')),
        bad: (d, f) => edit(d, f.expect.others[0], (s) => s.replace('"GBP": 0.52', '"GBP": 0.52,\n        "NZD": 1.09')),
    },
    C: {
        good: (d, f) => edit(d, f.expect.path, (s) => s.replace('Thanks,\nLedger', 'Kind regards, the Accounts team')),
        bad: (d, f) => edit(d, f.expect.others[0], (s) => s.replace('Thanks,\nLedger', 'Kind regards, the Accounts team')),
    },
};

// ---- number
const limiterCode = (limit) =>
    'const LIMIT = ' + limit + ';\n\nexport function createLimiter({ now = Date.now } = {}) {\n    const hits = new Map();\n    return {\n' +
    '        allow(clientId) {\n            const t = now();\n            const recent = (hits.get(clientId) || []).filter((x) => t - x < 60000);\n' +
    '            if (recent.length >= LIMIT) {\n                hits.set(clientId, recent);\n                return false;\n            }\n' +
    '            recent.push(t);\n            hits.set(clientId, recent);\n            return true;\n        },\n    };\n}\n';
const batchCode = (n) => 'export function batches(entries) {\n    const out = [];\n    for (let i = 0; i < entries.length; i += ' + n + ') out.push(entries.slice(i, i + ' + n + '));\n    return out;\n}\n';
const pageCode = (n) => 'export function paginate(items, page) {\n    return items.slice((page - 1) * ' + n + ', page * ' + n + ');\n}\n';
const NUM = { limit: ['src/ratelimit.js', limiterCode], batch: ['src/batch.js', batchCode], page: ['src/paginate.js', pageCode] };
const number = {
    good: (d, f) => { const [file, code] = NUM[f.expect.kind]; write(d, file, code(f.expect.value)); },
    bad: (d, f) => { const [file, code] = NUM[f.expect.kind]; write(d, file, code(f.expect.value + 3)); },
};

const same = (s) => ({ A: s, B: s, C: s });
export const SOL = {
    ruling, decision, 'do-not': same(doNot), reversed, 'open-question': same(openQ),
    'in-flight': same(inFlight), path, number: same(number),
};
