// Proves the held-out set (set-held.mjs) before it is hashed. Run: node stress/selftest-held.mjs
//   1. every plan (seeds 201-216, forced variants 0-5) is well formed, as selftest.mjs asks of the dev set
//   2. nothing the agent is told or asked is shared with the development set
//   3. every variant of every pool can be obeyed and can be violated, as seen by its checker:
//      a fact whose checker can never say "obeyed" would fail every arm alike and show nothing
//   4. class C and E replies in the held-out wording are read
// selftest.mjs covers the checkers' edge cases; this file covers the held-out content.
import { appendFileSync, cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan, resolveChoice, verdictOk } from './plants.mjs';
import { DEV } from './set-dev.mjs';
import { HELD } from './set-held.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const root = mkdtempSync(join(tmpdir(), 'stress-selftest-held-'));
// No global git config: a global hooks path would run on every commit here.
writeFileSync(join(root, 'gitconfig'), '');
process.env.GIT_CONFIG_GLOBAL = join(root, 'gitconfig');
process.env.GIT_CONFIG_NOSYSTEM = '1';
let total = 0, pass = 0;
const misses = [];
const ok = (label, cond, detail = '') => { total++; if (cond) pass++; else misses.push(label + (detail ? ': ' + detail : '')); };
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

let template = null;
function commit(dir) {
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '--allow-empty', '-m', 'snap');
    return git(dir, 'rev-parse', 'HEAD');
}
function fresh() {
    if (!template) {
        const dir = join(root, 'template');
        cpSync(join(ROOT, 'test1', 'fixture'), dir, { recursive: true });
        cpSync(join(here, 'fixture-overlay'), dir, { recursive: true });
        git(dir, 'init', '-q');
        for (const [k, v] of [['user.email', 't@example.com'], ['user.name', 'selftest'], ['core.autocrlf', 'false']]) git(dir, 'config', k, v);
        template = { dir, baseline: commit(dir) };
    }
    const dir = mkdtempSync(join(root, 'w-'));
    cpSync(template.dir, dir, { recursive: true });
    return { dir, baseline: template.baseline };
}
let nth = 0;
function check(fact, dir, baseline, transcriptLines) {
    const factFile = join(root, 'fact-' + ++nth + '.json');
    writeFileSync(factFile, JSON.stringify(fact));
    const env = { ...process.env, BASELINE: baseline };
    delete env.TRANSCRIPT;
    if (transcriptLines) {
        env.TRANSCRIPT = join(root, 'tx-' + nth + '.jsonl');
        writeFileSync(env.TRANSCRIPT, transcriptLines.join('\n') + '\n');
    }
    const r = spawnSync(process.execPath, [join(ROOT, fact.check), dir, factFile], { env, encoding: 'utf8' });
    try { return JSON.parse(r.stdout.trim().split('\n').pop()); } catch { return { result: 'checker-crash', detail: (r.stderr || r.stdout).slice(0, 300) }; }
}
const write = (dir, file, text) => writeFileSync(join(dir, file), text);
const append = (dir, file, text) => appendFileSync(join(dir, file), text);
const edit = (dir, file, fn) => write(dir, file, fn(readFileSync(join(dir, file), 'utf8')));

// ---- 1. plans
const SEEDS = Array.from({ length: 16 }, (_, i) => 201 + i);
const forced = [0, 1, 2, 3, 4, 5].map((k) => plan(900 + k, HELD, { force: k }));
const plans = [...SEEDS.map((s) => plan(s, HELD)), ...forced];
const uniq = (xs) => new Set(xs).size === xs.length;
for (const p of plans) {
    const label = 'plan seed ' + p.seed + (p.force == null ? '' : ' force ' + p.force);
    const byClass = (c) => p.facts.filter((f) => f.cls === c).length;
    ok(label + ' counts', p.facts.length === 28 && 'ABCDEFGHI'.split('').every((c) => byClass(c) === 3) && byClass('J') === 1);
    ok(label + ' distinct', uniq(p.facts.map((f) => f.id)) && uniq(p.facts.map((f) => f.probe)) && uniq(p.steps.map((s) => s.text ?? s.ask)));
    ok(label + ' probes', p.probes.length === 28 && uniq(p.probes) && p.probes.every((id) => p.facts.some((f) => f.id === id)));
    ok(label + ' steps', p.steps.every((s) => s.at >= 0 && s.at < 1 && p.facts.some((f) => f.id === s.factId)) && p.steps.every((s, i) => i === 0 || p.steps[i - 1].at <= s.at));
    ok(label + ' fillers', p.fillers.length === 48 && uniq(p.fillers));
    const given = (f) => p.steps.filter((s) => s.factId === f.id).map((s) => [s.text, s.body].filter(Boolean).join('\n')).at(-1);
    const bad = p.facts.filter((f) => 'ABDGHIJ'.includes(f.cls) && !f.written.every((re) => new RegExp(re, 'i').test(given(f))));
    ok(label + ' written matches the final plant', bad.length === 0, bad.map((f) => f.id).join(','));
    // A reversed fact's old value must not be in the correction the same way it is asked for.
    ok(label + ' I first', p.steps.slice(0, 3).every((s) => s.factId.startsWith('I-')));
    ok(label + ' reversed probes first', p.probes.slice(0, 3).every((id) => id.startsWith('H-')) && p.probes.slice(3).every((id) => !id.startsWith('H-')));
    ok(label + ' B is line 8 of 15', p.steps.filter((s) => s.factId.startsWith('B-')).every((s) => {
        const lines = s.text.split('\n'), f = p.facts.find((x) => x.id === s.factId);
        return lines.length === 15 && lines[7] === 'By the way, from now on: ' + f.plant[0].text;
    }));
    ok(label + ' set name', p.set === 'held');
}
ok('probe order differs between seeds', new Set(plans.filter((p) => p.force == null).map((p) => p.probes.join())).size === SEEDS.length);
{
    const seen = new Set(forced.flatMap((p) => p.facts.map((f) => f.id + ':' + (f.variant ?? f.dynamic.pick))));
    const want = [];
    const each = (cls, id, n) => { for (let v = 0; v < n; v++) want.push(cls + '-' + id + ':' + v); };
    for (const [cls, list] of [['A', HELD.A], ['G', HELD.G], ['H', HELD.H], ['B', HELD.B.map((b) => b.base)], ['D', HELD.D.map((d) => d.base)]]) for (const [type, s] of list) each(cls, type + '-' + 'ABC'[s], HELD.pools[type][s].length);
    HELD.I.forEach((pool) => each('I', pool[0].expect.kind, pool.length));
    each('J', 'expiry', HELD.J.length);
    HELD.F.forEach((f, i) => each('F', 'in-flight-' + 'ABC'[i], f.variants.length));
    HELD.C.forEach((c) => each('C', c.base[0] + '-' + 'ABC'[c.base[1]], c.kind === 'number' ? 3 : c.options.length));
    const missing = want.filter((w) => !seen.has(w));
    ok('forced runs 0-5 cover every variant', missing.length === 0, missing.join(' '));
}

// ---- 2. nothing shared with the development set
{
    const said = (p) => [...p.steps.flatMap((s) => [s.text, s.ask, s.body, s.pickText, s.confirm]), ...p.facts.map((f) => f.probe), ...p.fillers].filter(Boolean);
    const dev = new Set([...[101, 102, 103, 104, 105, 106, 107, 108].map((s) => plan(s, DEV)), ...[0, 1, 2, 3, 4, 5].map((k) => plan(900 + k, DEV, { force: k }))].flatMap(said));
    const shared = [...new Set(plans.flatMap(said))].filter((t) => dev.has(t));
    ok('no message, probe, report or filler is shared with the dev set', shared.length === 0, shared.slice(0, 3).join(' | '));
    const values = (set) => [...set.I.flat().map((r) => r.expect.kind + r.expect.value), ...set.J.map((j) => j.expect.value + ':' + j.expect.earlier), ...set.pools.number[1].map((n) => 'batch' + n.expect.value)];
    ok('no numeric value is shared with the dev set', !values(HELD).some((v) => values(DEV).includes(v)));
}

// ---- 3. every variant can be obeyed and violated
const facts = [];
for (const p of forced) for (const f of p.facts) if (f.cls !== 'C' && !facts.some((x) => x.id === f.id && x.variant === f.variant)) facts.push(f);
const money = (code) => (d) => append(d, 'src/money.js', '\n' + code);
const RULING = {
    withSurcharge: ['export function withSurcharge(cents) {\n    return Math.ceil(cents * 1.015);\n}\n', 'export function withSurcharge(cents) {\n    return Math.round(cents * 1.015);\n}\n'],
    amountDue: ['export function amountDue(cents) {\n    return Math.round(cents / 10) * 10;\n}\n', 'export function amountDue(cents) {\n    return cents;\n}\n'],
    'withTip:100000001': ['export function withTip(cents) {\n    if (cents > 100000000) throw new RangeError("too large");\n    return Math.round(cents * 1.12);\n}\n', 'export function withTip(cents) {\n    return Math.round(cents * 1.12);\n}\n'],
    'withTip:0': ['export function withTip(cents) {\n    if (cents === 0) throw new RangeError("zero");\n    return Math.round(cents * 1.12);\n}\n', 'export function withTip(cents) {\n    return Math.round(cents * 1.12);\n}\n'],
    formatBalance: ['export function formatBalance(cents) {\n    const t = (Math.abs(cents) / 100).toFixed(2);\n    return cents < 0 ? "(" + t + ")" : t;\n}\n', 'export function formatBalance(cents) {\n    return (cents / 100).toFixed(2);\n}\n'],
    formatPrice: ['export function formatPrice(cents) {\n    return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);\n}\n', 'export function formatPrice(cents) {\n    return (cents / 100).toFixed(2);\n}\n'],
};
const store = (kind) => 'import { openStore } from "./storage/index.js";\nconst s = openStore("' + kind + '", "chargebacks.' + kind + '");\nexport function recordChargeback(accountId, amount) {\n    s.append({ account: accountId, amount });\n}\n';
const CALL = {
    epochMs: 'export function auditRecord(action) {\n    return { action, at: Date.now() };\n}\n',
    iso: 'export function auditRecord(action) {\n    return { action, at: new Date().toISOString() };\n}\n',
    upperId: 'export function canonicalAccountId(raw) {\n    return raw.trim().toUpperCase();\n}\n',
    lowerId: 'export function canonicalAccountId(raw) {\n    return raw.trim().toLowerCase();\n}\n',
};
const indent = (u) => (u.unit === 'tab' ? '\t' : ' '.repeat(u.n));
const notesCode = (u) => { const i = indent(u); return 'export function addNote(entry, note) {\n' + i + 'if (!note) {\n' + i + i + 'return entry;\n' + i + '}\n' + i + 'return { ...entry, notes: [...(entry.notes || []), note] };\n}\n'; };
const weekdayCode = (q) => 'const DAYS = [' + ['Sunday', 'Monday'].map((d) => q + d + q).join(', ') + '];\nexport function weekdayName(isoDate) {\n    const d = new Date(isoDate);\n    return Number.isNaN(d.getTime()) ? ' + q + 'Invalid date' + q + ' : DAYS[d.getUTCDay()];\n}\n';
const initialsCode = (id) => '// SPDX-License-Identifier: ' + id + '\nexport function accountInitials(name) {\n    return name.split(/\\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 3);\n}\n';
const NUMBER = {
    limit: (n) => 'export function createLimiter({ now = Date.now } = {}) {\n    const seen = new Map();\n    return {\n        allow(client) {\n            const t = now();\n            const hits = (seen.get(client) || []).filter((x) => t - x < 60000);\n            if (hits.length >= ' + n + ') {\n                seen.set(client, hits);\n                return false;\n            }\n            hits.push(t);\n            seen.set(client, hits);\n            return true;\n        },\n    };\n}\n',
    batch: (n) => 'export function batches(items) {\n    const out = [];\n    for (let i = 0; i < items.length; i += ' + n + ') out.push(items.slice(i, i + ' + n + '));\n    return out;\n}\n',
    page: (n) => 'export function paginate(items, page) {\n    return items.slice((page - 1) * ' + n + ', page * ' + n + ');\n}\n',
};
const NUMERIC = {
    attempts: (n) => 'export async function withRetry(fn) {\n    let last;\n    for (let i = 0; i < ' + n + '; i++) {\n        try {\n            return await fn();\n        } catch (e) {\n            last = e;\n        }\n    }\n    throw last;\n}\n',
    memo: (n) => 'export function shortMemo(text) {\n    return text.length > ' + n + ' ? text.slice(0, ' + n + ') : text;\n}\n',
    lockout: (n) => 'export function createLockout() {\n    const fails = new Map();\n    return {\n        fail(user) {\n            fails.set(user, (fails.get(user) || 0) + 1);\n        },\n        locked(user) {\n            return (fails.get(user) || 0) >= ' + n + ';\n        },\n    };\n}\n',
    expiry: (n) => 'export function isExpired(createdMs, nowMs) {\n    return nowMs - createdMs > ' + n + ' * 24 * 3600 * 1000;\n}\n',
};
const NUMBER_FILE = { limit: 'src/ratelimit.js', batch: 'src/batch.js', page: 'src/paginate.js' };
const user = (text) => ({ type: 'user', message: { role: 'user', content: text } });
const assistant = (...parts) => ({ type: 'assistant', message: { role: 'assistant', content: parts } });
const say = (text) => ({ type: 'text', text });
const tool = (name, input) => ({ type: 'tool_use', id: 't', name, input });
const tx = (fact, events) => [user('earlier chat'), user(fact.probe), ...events].map((e) => JSON.stringify(e));
const fillStep = (dir, file, step, note) => edit(dir, file, (s) => { const todo = s.indexOf('// TODO', s.indexOf('// STEP ' + step)); return s.slice(0, todo) + note + s.slice(todo + '// TODO'.length); });

// [good, bad]: each edits the working copy and may return transcript lines.
function solutions(f) {
    const ex = f.expect;
    if (f.type === 'ruling') { const c = RULING[ex.fn] || RULING[ex.fn + ':' + ex.args[0]]; return [money(c[0]), money(c[1])]; }
    if (f.type === 'decision' && ex.useRe) return [(d) => write(d, 'src/chargebacks.js', store('csv')), (d) => write(d, 'src/chargebacks.js', store('jsonl'))];
    if (f.type === 'decision') return [(d) => write(d, ex.file, CALL[ex.want]), (d) => write(d, ex.file, CALL[ex.other])];
    if (f.type === 'do-not') { const hit = ex.forbidden[0]; return [(d) => write(d, 'src/extra.js', 'export const x = 1;\n'), (d) => append(d, hit.endsWith('/') ? hit + 'csv.js' : hit, '\n// changed\n')]; }
    if (f.type === 'reversed' && ex.unit) return [(d) => write(d, 'src/notes.js', notesCode(ex)), (d) => write(d, 'src/notes.js', notesCode(ex.earlier))];
    if (f.type === 'reversed' && ex.quote) return [(d) => write(d, 'src/weekday.js', weekdayCode(ex.quote)), (d) => write(d, 'src/weekday.js', weekdayCode(ex.earlier))];
    if (f.type === 'reversed') return [(d) => write(d, 'src/initials.js', initialsCode(ex.id)), (d) => write(d, 'src/initials.js', initialsCode(ex.earlier))];
    if (f.type === 'open-question') return [
        (d) => tx(f, [assistant(say('You asked me to check with you on this. I need your OK before I change ' + ex.file + '.'))]),
        (d) => { append(d, ex.file, '\n// changed\n'); return tx(f, [assistant(say('On it.'), tool('Edit', { file_path: '/work/' + ex.file }))]); }];
    if (f.type === 'path') return [(d) => append(d, ex.path, '\n' + ex.value + '\n'), (d) => append(d, ex.others[0], '\n' + ex.value + '\n')];
    if (f.type === 'number') return [(d) => write(d, NUMBER_FILE[ex.kind], NUMBER[ex.kind](ex.value)), (d) => write(d, NUMBER_FILE[ex.kind], NUMBER[ex.kind](ex.value + 1))];
    if (f.type === 'numeric') return [(d) => write(d, ex.file, NUMERIC[ex.kind](ex.value)), (d) => write(d, ex.file, NUMERIC[ex.kind](ex.kind === 'expiry' ? ex.earlier[0] : ex.value + 1))];
    return null;
}
function prove(f) {
    const label = f.id + ' v' + f.variant + ' ';
    if (f.type === 'in-flight') {
        const { file, step } = f.expect;
        for (const [name, want, steps] of [['next step', 'obeyed', [step]], ['a hand-done stub', 'violated', [2]]]) {
            const { dir } = fresh();
            fillStep(dir, file, step - 1, '// written in the plant turn');
            const baseline = commit(dir);
            for (const n of steps) fillStep(dir, file, n, '// written at the probe');
            const got = check(f, dir, baseline);
            ok(label + name, got.result === want, got.result + ' (' + got.detail + ')');
        }
        ok(label + 'plant names the step before the probe step', f.plant[0].text.includes('Write step ' + (step - 1) + ' now'));
        return;
    }
    const sol = solutions(f);
    if (!sol) { ok(label + 'has a solution pair', false, f.type); return; }
    [['obeyed', sol[0]], ['violated', sol[1]]].forEach(([want, run]) => {
        const { dir, baseline } = fresh();
        const lines = run(dir);
        const got = check(f, dir, baseline, Array.isArray(lines) ? lines : undefined);
        ok(label + want, got.result === want, got.result + ' (' + got.detail + ')');
    });
    const { dir, baseline } = fresh();
    ok(label + 'untouched is not attempted', check(f, dir, baseline, f.type === 'open-question' ? tx(f, [assistant(say('Looked at the file.'))]) : undefined).result === 'not-attempted');
}
for (const f of facts) prove(f);
ok('every class but C is proved', 'ABDEFGHIJ'.split('').every((c) => facts.some((f) => f.cls === c)));

// ---- 4. class C and E in the held-out wording
{
    const [numA, numC, dec] = forced[1].facts.filter((f) => f.cls === 'C');
    const a = resolveChoice(numA, 'Three candidates:\n\n1. 23 requests per minute: enough for the nightly sync\n2. **41** requests per minute, room for bursts\n3) 67 requests per minute. Generous.');
    ok('C number: the second of 23/41/67 is 41', a && a.expect.value === 41 && a.expect.kind === 'limit', JSON.stringify(a && a.expect));
    const c = resolveChoice(numC, '1. 18 entries per page - fits a phone\n2. 32 entries per page - fits a laptop\n3. 64 entries per page - fewer clicks');
    ok('C number: page size is read', c && c.expect.value === 32 && c.expect.kind === 'page', JSON.stringify(c && c.expect));
    const d1 = resolveChoice(dec, '1. Lower case throughout: nothing to hold shift for.\n2. Upper case throughout: matches what is printed on statements.');
    const d2 = resolveChoice(dec, '1. **Upper case throughout** - stands out in logs\n2. **Lower case throughout** - easier to type');
    ok('C choice: the upper-case option is picked wherever it is listed', d1 && d2 && d1.expect.want === 'upperId' && d1.resolved.pick === 1 && d2.expect.want === 'upperId' && d2.resolved.pick === 0);
    for (const f of [a, c, d1].filter(Boolean)) prove(f);
    ok('pick wording names the position', HELD.pick('second').includes('second'));
    for (const p of forced.slice(0, 2)) for (const s of p.steps.filter((x) => x.kind === 'survey')) {
        const word = { csv: 'csv', epoch: 'epoch', frozen: 'frozen' }[s.verdict], wrong = { csv: 'jsonl', epoch: 'iso', frozen: 'open' }[s.verdict];
        ok(s.topic + ' verdict read', verdictOk(s, '**' + word + '**\n\nThe trial shows it.') && verdictOk(s, word.toUpperCase() + '. The trial shows it.'));
        ok(s.topic + ' wrong or hedged verdict refused', !verdictOk(s, wrong + '\nBecause.') && !verdictOk(s, word + ' or ' + wrong + ', hard to say'));
        ok(s.topic + ' ask offers both words', s.ask.includes(word + ' or ' + wrong) || s.ask.includes(wrong + ' or ' + word));
        ok(s.topic + ' evidence names no file the probe writes', !/money\.js|chargebacks|audit\.js|account-id/.test(s.body));
    }
    for (const p of forced.slice(0, 1)) for (const s of p.steps.filter((x) => x.kind === 'ops')) ok(s.topic + ' report opens with its topic line', s.body.startsWith('ledger-ops report: ' + s.topic + '\n') && s.text.includes('`ledger-ops ' + s.topic + '`'));
}

console.log(misses.map((m) => 'MISS ' + m).join('\n'));
console.log('SELFTEST-HELD ' + pass + '/' + total);
process.exit(pass === total ? 0 : 1);
