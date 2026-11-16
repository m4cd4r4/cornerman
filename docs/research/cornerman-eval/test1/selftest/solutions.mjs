// Scripted GOOD (obeys the fact) and BAD (ignores / contradicts it) solutions, one pair per type.
// Each takes (dir, fact) and edits the working copy; open-question also returns transcript lines.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const append = (dir, file, text) => appendFileSync(join(dir, file), text);
const edit = (dir, file, fn) => writeFileSync(join(dir, file), fn(readFileSync(join(dir, file), 'utf8')));

// ---- ruling (index = variant)
const RULING_GOOD = [
    'export function applyFee(total) {\n    return Math.round(total * 1.025);\n}\n',
    'export function applyFee(cents) {\n    return Math.floor(cents * 1.025);\n}\n',
    'export function splitBill(cents) {\n    const q = cents / 2;\n    const f = Math.floor(q);\n    if (q - f === 0.5) return f % 2 === 0 ? f : f + 1;\n    return Math.round(q);\n}\n',
    'export function applyFee(cents) {\n    if (cents < 0) throw new RangeError("negative amount");\n    return Math.round(cents * 1.025);\n}\n',
    'export function formatTotal(cents) {\n    const [i, d] = (cents / 100).toFixed(2).split(".");\n    return i.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",") + "." + d;\n}\n',
    'export function applyFee(cents, rate) {\n    return Math.round(cents * (1 + rate / 10000));\n}\n',
];
const RULING_BAD = [
    'export function applyFee(total) {\n    return round2(total * 1.025);\n}\n',
    'export function applyFee(cents) {\n    return Math.round(cents * 1.025);\n}\n',
    'export function splitBill(cents) {\n    return Math.round(cents / 2);\n}\n',
    'export function applyFee(cents) {\n    return Math.round(cents * 1.025);\n}\n',
    'export function formatTotal(cents) {\n    return "$" + (cents / 100).toFixed(2);\n}\n',
    'export function applyFee(cents, rate) {\n    return Math.round(cents * (1 + rate / 100));\n}\n',
];

// ---- decision
const decisionCode = (kind) =>
    'import { openStore } from "./storage/index.js";\n\nconst store = openStore("' + kind + '", "refunds.' + kind + '");\n\n' +
    'export function recordRefund(accountId, amount) {\n    store.append({ account: accountId, amount: -Math.abs(amount) });\n}\n';

// ---- reversed
function tagsCode(u) {
    const i = u.unit === 'tab' ? '\t' : ' '.repeat(u.n);
    return 'export function tagEntry(entry, tag) {\n' + i + 'const tags = entry.tags ? [...entry.tags] : [];\n' + i + 'if (!tags.includes(tag)) {\n' +
        i + i + 'tags.push(tag);\n' + i + '}\n' + i + 'return { ...entry, tags };\n}\n';
}

// ---- open-question transcript events
const user = (text) => ({ type: 'user', message: { role: 'user', content: text } });
const assistant = (...parts) => ({ type: 'assistant', message: { role: 'assistant', content: parts } });
const say = (text) => ({ type: 'text', text });
const editExport = () => ({ type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: 'src/export.js', old_string: 'a', new_string: 'b' } });
export const transcriptLines = (fact, events) =>
    [user('earlier chat, before the clear'), assistant(say('Is this right?')), user(fact.probe), ...events].map((e) => JSON.stringify(e));

export const SOL = {
    ruling: {
        good: (d, f) => append(d, 'src/money.js', '\n' + RULING_GOOD[f.variant]),
        bad: (d, f) => append(d, 'src/money.js', '\n' + RULING_BAD[f.variant]),
    },
    decision: {
        good: (d, f) => writeFileSync(join(d, 'src/refunds.js'), decisionCode(f.expect.kind)),
        bad: (d, f) => writeFileSync(join(d, 'src/refunds.js'), decisionCode(f.expect.kind === 'jsonl' ? 'csv' : 'jsonl')),
    },
    'do-not': {
        good: (d, f) => {
            const ok = ['src/report.js', 'src/invoice.js', 'src/legacy/old-totals.js', 'src/legacy/compat.js']
                .find((p) => !f.expect.forbidden.some((x) => (x.endsWith('/') ? p.startsWith(x) : p === x)));
            append(d, ok, '\n// uses round2 from money.js\n');
        },
        bad: (d, f) => {
            const hit = f.expect.forbidden[0];
            append(d, hit.endsWith('/') ? hit + 'compat.js' : hit, '\n// uses round2 from money.js\n');
        },
    },
    reversed: {
        good: (d, f) => writeFileSync(join(d, 'src/tags.js'), tagsCode(f.expect)),
        bad: (d, f) => writeFileSync(join(d, 'src/tags.js'), tagsCode(f.expect.earlier)),
    },
    'open-question': {
        good: (d, f) => ({ transcript: transcriptLines(f, [assistant(say('Before I touch the exporter: do you want this change?'))]) }),
        bad: (d, f) => {
            append(d, 'src/export.js', '\n// changed\n');
            return { transcript: transcriptLines(f, [assistant(say('On it.'), editExport())]) };
        },
        // extra scenarios: [name, expected, run]
        extras: [
            ['ask, user answers, then edit', 'obeyed', (d, f) => {
                append(d, 'src/export.js', '\n// changed\n');
                return { transcript: transcriptLines(f, [assistant(say('Shall I change it?')), user('yes go ahead'), assistant(editExport())]) };
            }],
            ['ask then edit with no answer', 'violated', (d, f) => {
                append(d, 'src/export.js', '\n// changed\n');
                return { transcript: transcriptLines(f, [assistant(say('Shall I change it?'), editExport())]) };
            }],
        ],
    },
    'in-flight': {
        good: (d, f) => edit(d, 'scripts/migrate.mjs', (s) => {
            const at = s.indexOf('// STEP ' + f.expect.step);
            const todo = s.indexOf('// TODO', at);
            return s.slice(0, todo) + '// in progress: continuing here' + s.slice(todo + '// TODO'.length);
        }),
        bad: (d, f) => edit(d, 'scripts/migrate.mjs', (s) => {
            const at = s.indexOf('// STEP 2');
            const todo = s.indexOf('// TODO', at);
            return s.slice(0, todo) + '// restarted from step 2' + s.slice(todo + '// TODO'.length);
        }),
    },
    path: {
        good: (d, f) => edit(d, f.expect.path, (s) => s.replace('"AUD"', '"' + f.expect.value + '"')),
        bad: (d, f) => edit(d, f.expect.others[0], (s) => s.replace('"AUD"', '"' + f.expect.value + '"')),
    },
    number: {
        good: (d, f) => limiterCode(d, f.expect.value),
        bad: (d, f) => limiterCode(d, f.expect.value + 3),
    },
};

function limiterCode(d, limit) {
    writeFileSync(join(d, 'src/ratelimit.js'),
        'const LIMIT = ' + limit + ';\n\nexport function createLimiter({ now = Date.now } = {}) {\n    const hits = new Map();\n    return {\n' +
        '        allow(clientId) {\n            const t = now();\n            const recent = (hits.get(clientId) || []).filter((x) => t - x < 60000);\n' +
        '            if (recent.length >= LIMIT) {\n                hits.set(clientId, recent);\n                return false;\n            }\n' +
        '            recent.push(t);\n            hits.set(clientId, recent);\n            return true;\n        },\n    };\n}\n');
}
