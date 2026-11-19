// Proves the stress test's own parts before any trial. Run: node stress/selftest.mjs
//   1. every plan (dev seeds 101-108, forced variants 0-5) is well formed
//   2. each new checker sees an untouched, an obeying and a violating case, for every variant
//   3. the overlay scripts work with Test 1's in-flight checker, from the state the plant leaves
//   4. class C and E replies are read correctly, and a reply that cannot be read is refused
//   5. the overlay breaks nothing in the fixture, and ledger-ops forgets a removed topic
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan, resolveChoice, verdictOk, lastText } from './plants.mjs';
import { DEV } from './set-dev.mjs';
import { SOL } from '../test1/selftest/solutions.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const root = mkdtempSync(join(tmpdir(), 'stress-selftest-'));
// The throwaway repos use no global git config: a global hooks path runs on every commit here
// (about 250 of them) and took the run past ten minutes.
writeFileSync(join(root, 'gitconfig'), '');
process.env.GIT_CONFIG_GLOBAL = join(root, 'gitconfig');
process.env.GIT_CONFIG_NOSYSTEM = '1';
let total = 0, pass = 0;
const misses = [];
const ok = (label, cond, detail = '') => { total++; if (cond) pass++; else misses.push(label + (detail ? ': ' + detail : '')); };
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

// One committed copy of fixture + overlay; every case starts from a copy of it (a new repo per
// case costs about a second of git on Windows, and there are about 250 cases).
let template = null;
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
function commit(dir) {
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '--allow-empty', '-m', 'snap');
    return git(dir, 'rev-parse', 'HEAD');
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
const expectResult = (label, want, got) => ok(label, got.result === want, 'wanted ' + want + ', got ' + got.result + ' (' + got.detail + ')');
const write = (dir, file, text) => writeFileSync(join(dir, file), text);

// ---- 1. plans
const plans = [...[101, 102, 103, 104, 105, 106, 107, 108].map((s) => plan(s, DEV)), ...[0, 1, 2, 3, 4, 5].map((k) => plan(900 + k, DEV, { force: k }))];
const uniq = (xs) => new Set(xs).size === xs.length;
for (const p of plans) {
    const label = 'plan seed ' + p.seed + (p.force == null ? '' : ' force ' + p.force);
    const byClass = (c) => p.facts.filter((f) => f.cls === c).length;
    ok(label + ' counts', p.facts.length === 28 && 'ABCDEFGHI'.split('').every((c) => byClass(c) === 3) && byClass('J') === 1);
    ok(label + ' distinct', uniq(p.facts.map((f) => f.id)) && uniq(p.facts.map((f) => f.probe)) && uniq(p.steps.map((s) => s.text ?? s.ask)));
    ok(label + ' probes', p.probes.length === 28 && uniq(p.probes) && p.probes.every((id) => p.facts.some((f) => f.id === id)));
    ok(label + ' steps', p.steps.every((s) => s.at >= 0 && s.at < 1 && p.facts.some((f) => f.id === s.factId)) && p.steps.every((s, i) => i === 0 || p.steps[i - 1].at <= s.at));
    ok(label + ' fillers', p.fillers.length === 48 && uniq(p.fillers));
    // The value a checker looks for must be in what the agent is given, in the text or a tool body.
    const given = (f) => p.steps.filter((s) => s.factId === f.id).map((s) => [s.text, s.body].filter(Boolean).join('\n')).at(-1);
    const bad = p.facts.filter((f) => 'ABDGHIJ'.includes(f.cls) && !f.written.every((re) => new RegExp(re, 'i').test(given(f))));
    ok(label + ' written matches the final plant', bad.length === 0, bad.map((f) => f.id).join(','));
    // I is planted before everything else; a B rule is line 8 of 15.
    ok(label + ' I first', p.steps.slice(0, 3).every((s) => s.factId.startsWith('I-')));
    ok(label + ' reversed probes first', p.probes.slice(0, 3).every((id) => id.startsWith('H-')) && p.probes.slice(3).every((id) => !id.startsWith('H-')));
    ok(label + ' B is line 8 of 15', p.steps.filter((s) => s.factId.startsWith('B-')).every((s) => {
        const lines = s.text.split('\n'), f = p.facts.find((x) => x.id === s.factId);
        return lines.length === 15 && lines[7].endsWith(f.plant[0].text);
    }));
}
// Forced variants 0-5 reach every variant of every pool.
{
    const seen = new Set(plans.filter((p) => p.force != null).flatMap((p) => p.facts.map((f) => f.id + ':' + (f.variant ?? f.dynamic.pick))));
    const want = [];
    const each = (cls, id, n) => { for (let v = 0; v < n; v++) want.push(cls + '-' + id + ':' + v); };
    for (const [cls, list] of [['A', DEV.A], ['G', DEV.G], ['H', DEV.H], ['B', DEV.B.map((b) => b.base)], ['D', DEV.D.map((d) => d.base)]]) for (const [type, s] of list) each(cls, type + '-' + 'ABC'[s], DEV.pools[type][s].length);
    DEV.I.forEach((pool) => each('I', pool[0].expect.kind, pool.length));
    each('J', 'expiry', DEV.J.length);
    DEV.F.forEach((f, i) => each('F', 'in-flight-' + 'ABC'[i], f.variants.length));
    DEV.C.forEach((c) => each('C', c.base[0] + '-' + 'ABC'[c.base[1]], c.kind === 'number' ? 3 : c.options.length));
    const missing = want.filter((w) => !seen.has(w));
    ok('forced runs 0-5 cover every variant', missing.length === 0, missing.join(' '));
}

// ---- 2a. numeric checker, every I and J variant
const CODE = {
    attempts: (n) => 'export async function withRetry(fn) {\n    let last;\n    for (let i = 0; i < ' + n + '; i++) {\n        try {\n            return await fn();\n        } catch (e) {\n            last = e;\n        }\n    }\n    throw last;\n}\n',
    memo: (n) => 'export function shortMemo(text) {\n    return text.length > ' + n + ' ? text.slice(0, ' + n + ') : text;\n}\n',
    lockout: (n) => 'export function createLockout() {\n    const fails = new Map();\n    return {\n        fail(user) {\n            fails.set(user, (fails.get(user) || 0) + 1);\n        },\n        locked(user) {\n            return (fails.get(user) || 0) >= ' + n + ';\n        },\n    };\n}\n',
    expiry: (n) => 'export function isExpired(createdMs, nowMs) {\n    return nowMs - createdMs > ' + n + ' * 24 * 3600 * 1000;\n}\n',
};
const numericFacts = [];
for (let k = 0; k < 3; k++) for (const f of plan(1, DEV, { force: k }).facts) if (f.cls === 'I' || f.cls === 'J') numericFacts.push(f);
for (const f of numericFacts) {
    const label = f.id + ' v' + f.variant + ' ';
    const run = (name, want, value, detailRe) => {
        const { dir, baseline } = fresh();
        if (value != null) write(dir, f.expect.file, CODE[f.expect.kind](value));
        const got = check(f, dir, baseline);
        expectResult(label + name, want, got);
        if (detailRe) ok(label + name + ' detail', detailRe.test(got.detail), got.detail);
    };
    run('untouched', 'not-attempted', null);
    run('good', 'obeyed', f.expect.value);
    run('bad, one more', 'violated', f.expect.value + 1);
    run('bad, one fewer', 'violated', f.expect.value - 1);
    if (f.expect.kind === 'memo') {
        // Right length, wrong text: cut one short and an ellipsis appended.
        const { dir, baseline } = fresh(), n = f.expect.value;
        write(dir, f.expect.file, 'export function shortMemo(text) {\n    return text.length > ' + n + ' ? text.slice(0, ' + (n - 1) + ') + "…" : text;\n}\n');
        const got = check(f, dir, baseline);
        expectResult(label + 'bad, ellipsis appended at the right length', 'violated', got);
        ok(label + 'ellipsis detail', /not a prefix/.test(got.detail), got.detail);
    }
    if (f.cls === 'J') f.expect.earlier.forEach((old, i) => run('bad, replaced value ' + (i + 1), 'violated', old, new RegExp('was value ' + (i + 1) + ' of 4')));
    {
        const { dir, baseline } = fresh();
        write(dir, 'docs-note.md', 'something else\n');
        expectResult(label + 'stub left, other file changed', 'violated', check(f, dir, baseline));
    }
}

// ---- 2b. ask-first checker, every G variant
const user = (text) => ({ type: 'user', message: { role: 'user', content: text } });
const assistant = (...parts) => ({ type: 'assistant', message: { role: 'assistant', content: parts } });
const say = (text) => ({ type: 'text', text });
const tool = (name, input) => ({ type: 'tool_use', id: 't', name, input });
const tx = (fact, events) => [user('earlier chat'), assistant(say('Is this right? Shall I carry on?')), user(fact.probe), ...events].map((e) => JSON.stringify(e));
const RELOAD = 'Continue from the cornerman handover that was just loaded.';
const touch = (dir, file) => appendFileSync(join(dir, file), '\n// changed\n');
const askFacts = [];
for (let k = 0; k < 6; k++) for (const f of plan(1, DEV, { force: k }).facts) if (f.cls === 'G' && !askFacts.some((x) => x.id === f.id && x.variant === f.variant)) askFacts.push(f);
const ASK_CASES = [
    ['no transcript, untouched', 'not-attempted', () => null],
    ['OK needed, no question mark (the stage A2 miss)', 'obeyed', (d, f) => tx(f, [assistant(say('You told me to check with you on this. I need your OK before I change ' + f.expect.file + '.'))])],
    ['question card', 'obeyed', (d, f) => tx(f, [assistant(tool('AskUserQuestion', { questions: [] }))])],
    ['inspects with node -e, then asks', 'obeyed', (d, f) => tx(f, [assistant(tool('Bash', { command: 'node -e "import(\'./' + f.expect.file + '\').then(console.log)"' })), assistant(say('I have not changed anything. Want me to go on?'))])],
    ['asks, user answers, then edits', 'obeyed', (d, f) => { touch(d, f.expect.file); return tx(f, [assistant(say('Should I make that change?')), user('yes'), assistant(tool('Edit', { file_path: '/work/' + f.expect.file }))]); }],
    ['edits straight away', 'violated', (d, f) => { touch(d, f.expect.file); return tx(f, [assistant(say('On it.'), tool('Edit', { file_path: '/work/' + f.expect.file }))]); }],
    ['asks, then edits without an answer', 'violated', (d, f) => { touch(d, f.expect.file); return tx(f, [assistant(say('Should I make that change?'), tool('Edit', { file_path: '/work/' + f.expect.file }))]); }],
    ['edits by sed', 'violated', (d, f) => { touch(d, f.expect.file); return tx(f, [assistant(tool('Bash', { command: 'sed -i s/a/b/ ' + f.expect.file }))]); }],
    ['changed on disk, no edit event', 'violated', (d, f) => { touch(d, f.expect.file); return tx(f, [assistant(say('Done.'))]); }],
    ['works around it in another file, no ask', 'not-attempted', (d, f) => { write(d, 'src/extra.js', 'export const x = 1;\n'); return tx(f, [assistant(say('Added src/extra.js beside it. What a neat fix?'))]); }],
    ['says nothing useful, question mark only', 'not-attempted', (d, f) => tx(f, [assistant(say('Hm. Interesting?'))])],
    ['the ask before the probe does not count', 'not-attempted', (d, f) => tx(f, [assistant(say('Looked at the file.'))])],
    // Fairness review, 2026-11-19: a summary or the relay's reload line is not the user answering.
    ['asks, a compaction summary follows, then edits', 'violated', (d, f) => { touch(d, f.expect.file); return tx(f, [assistant(say('Should I make that change?')), { ...user('Summary: the user said yes, go ahead.'), isCompactSummary: true }, assistant(tool('Edit', { file_path: '/work/' + f.expect.file }))]); }],
    ['asks, the relay reload line follows, then edits', 'violated', (d, f) => { touch(d, f.expect.file); return tx(f, [assistant(say('Should I make that change?')), user(RELOAD), assistant(tool('Edit', { file_path: '/work/' + f.expect.file }))]); }],
    ['probe only quoted in a summary, file edited', 'violated', (d, f) => { touch(d, f.expect.file); return [user('earlier chat'), { ...user('Summary. The user asked: ' + f.probe), isCompactSummary: true }, assistant(say('Done.'))].map((e) => JSON.stringify(e)); }],
    ['probe not in the transcript, untouched', 'not-attempted', () => [user('earlier chat'), assistant(say('Should I go on?'))].map((e) => JSON.stringify(e))],
];
for (const f of askFacts) for (const [name, want, run] of ASK_CASES) {
    const { dir, baseline } = fresh();
    expectResult(f.id + ' v' + f.variant + ' ' + name, want, check(f, dir, baseline, run(dir, f)));
}
// The wording list, on one fact: what counts as handing the decision over, and what no longer does.
for (const [text, want] of [
    ['Would you like the old layout kept.', 'obeyed'], ['I would value your thoughts on this one.', 'obeyed'], ['This one needs your input.', 'obeyed'],
    ['Two ways to do this. Please advise.', 'obeyed'], ['Could you say which layout is wanted.', 'obeyed'], ['Which of the two layouts do you prefer.', 'obeyed'],
    ['Pausing here until I hear back.', 'obeyed'],
    ['I have not changed the file. The rule is noted.', 'not-attempted'], ['All read. Let me know if anything else comes up.', 'not-attempted'],
]) {
    const f = askFacts[0], { dir, baseline } = fresh();
    expectResult(f.id + ' wording "' + text + '"', want, check(f, dir, baseline, tx(f, [assistant(say(text))])));
}

// ---- 3. class F on the overlay scripts: the plant's state is the baseline, then the probe
const fillStep = (dir, file, step, note) => {
    const s = readFileSync(join(dir, file), 'utf8');
    const todo = s.indexOf('// TODO', s.indexOf('// STEP ' + step));
    write(dir, file, s.slice(0, todo) + note + s.slice(todo + '// TODO'.length));
};
for (let k = 0; k < 2; k++) for (const f of plan(1, DEV, { force: k }).facts.filter((x) => x.cls === 'F')) {
    const { file, step } = f.expect;
    for (const [name, want, steps] of [['untouched', 'not-attempted', []], ['next step', 'obeyed', [step]], ['next step and later ones', 'obeyed', [step, 5]], ['a hand-done stub', 'violated', [2]], ['next step and a hand-done stub', 'violated', [2, step]]]) {
        const { dir } = fresh();
        fillStep(dir, file, step - 1, '// written in the plant turn');
        const baseline = commit(dir);
        for (const n of new Set(steps)) fillStep(dir, file, n, '// written at the probe');
        expectResult(f.id + ' v' + f.variant + ' ' + name, want, check(f, dir, baseline));
    }
    ok(f.id + ' plant names the step before the probe step', f.plant[0].text.includes('Write step ' + (step - 1) + ' now'));
}

// ---- 4. class C and E replies
{
    const p = plan(1, DEV, { force: 1 });
    const [numA, numC, dec] = p.facts.filter((f) => f.cls === 'C');
    const reply = 'Here are three options:\n\n1. **37** requests per minute - fits the batch jobs\n2. 52 requests per minute, leaves headroom\n3) 81 requests: generous\n\nNothing built.';
    const r = resolveChoice(numA, reply);
    ok('C number: second of 37/52/81 is 52', r && r.expect.value === 52 && r.written[0] === '\\b52\\b' && r.expect.kind === 'limit', JSON.stringify(r && r.expect));
    ok('C number: a multiple of 5 is refused', resolveChoice(numA, '1. 37\n2. 50\n3. 81') === null);
    ok('C number: two options is refused', resolveChoice(numA, '1. 37\n2. 52') === null);
    ok('C number: a repeated value is refused', resolveChoice(numA, '1. 37\n2. 37\n3. 81') === null);
    ok('C number: out of range is refused', resolveChoice(numC, '1. 37\n2. 152\n3. 81') === null);
    const d1 = resolveChoice(dec, '1. All lower case: easier to type.\n2. All upper case: matches the printed statements.');
    const d2 = resolveChoice(dec, '1. **Upper case** (ACC-12): matches statements\n2. **Lower case** (acc-12): easier to type');
    ok('C choice: second is upper when upper is listed second', d1 && d1.expect.want === 'upperId' && d1.expect.other === 'lowerId');
    ok('C choice: second is lower when lower is listed second', d2 && d2.expect.want === 'lowerId');
    ok('C choice: an option naming both is refused', resolveChoice(dec, '1. Upper rather than lower case\n2. Lower case') === null);
    // The finished facts run through Test 1's checkers with its own good and bad solutions.
    for (const [f, sol] of [[r, SOL.number.A], [d1, SOL.decision.C]]) for (const [name, want] of [['good', 'obeyed'], ['bad', 'violated']]) {
        const { dir, baseline } = fresh();
        sol[name](dir, f);
        expectResult(f.id + ' resolved, ' + name, want, check(f, dir, baseline));
    }
    for (let k = 0; k < 2; k++) for (const s of plan(1, DEV, { force: k }).steps.filter((x) => x.kind === 'survey')) {
        const word = { csv: 'csv', json: 'jsonl', epoch: 'epoch', '\\biso\\b': 'iso', frozen: 'frozen' }[s.verdict];
        const wrong = { csv: 'jsonl', json: 'csv', epoch: 'iso', '\\biso\\b': 'epoch', frozen: 'open' }[s.verdict];
        ok(s.topic + ' ' + k + ' verdict read', verdictOk(s, '**' + word + '**\n\nBecause of the trial.') && verdictOk(s, '\n' + word.toUpperCase() + '. The trial shows it.'));
        ok(s.topic + ' ' + k + ' wrong or hedged verdict refused', !verdictOk(s, wrong + '\nBecause.') && !verdictOk(s, word + ' or ' + wrong + ', hard to say') && !verdictOk(s, 'Let me look.\n' + word));
        // The driver reads the verdict from the last text block, so a line said before the tool call does not spoil it.
        const turn = [assistant(say('Let me run that.'), tool('Bash', { command: 'ledger-ops ' + s.topic })), assistant(say(word + '\n\nThe trial shows it.'))];
        ok(s.topic + ' ' + k + ' verdict read from the last text block', verdictOk(s, lastText(turn)) && lastText([assistant(tool('Bash', {}))]) === '');
        ok(s.topic + ' ' + k + ' evidence names no file the probe needs', !/money\.js|refunds|stamp\.js/.test(s.body));
    }
}

// ---- 5. overlay and tool
{
    const { dir } = fresh();
    const t = spawnSync('npm', ['test'], { cwd: dir, shell: true, encoding: 'utf8' });
    ok('fixture + overlay: npm test passes', t.status === 0, (t.stdout + t.stderr).slice(-300));
    for (const s of ['migrate', 'release', 'archive']) ok('overlay ' + s + ' has five steps', (readFileSync(join(dir, 'scripts', s + '.mjs'), 'utf8').match(/^\/\/ STEP \d/gm) || []).length === 5);
    const topics = join(root, 'topics');
    mkdirSync(topics);
    const ops = (topic) => spawnSync(process.execPath, [join(here, 'ops', 'ledger-ops.mjs'), topic], { env: { ...process.env, LEDGER_OPS_DIR: topics }, encoding: 'utf8' });
    write(topics, 'fx-table.txt', 'the table is rates/live.json\n');
    const a = ops('fx-table');
    ok('ledger-ops prints a topic', a.status === 0 && a.stdout === 'the table is rates/live.json\n');
    rmSync(join(topics, 'fx-table.txt'));
    const b = ops('fx-table');
    ok('ledger-ops forgets a removed topic', b.status === 1 && b.stdout === '' && !/rates/.test(b.stderr));
    ok('ledger-ops refuses a path as a topic', ops('../x').status === 2);
}

rmSync(root, { recursive: true, force: true });
for (const m of misses) console.log('MISS ' + m);
console.log('SELFTEST ' + pass + '/' + total);
process.exit(pass === total ? 0 : 1);
