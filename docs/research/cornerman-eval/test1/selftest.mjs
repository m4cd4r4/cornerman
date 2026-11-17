// Proves every checker sees both cases. Run: node selftest.mjs (from this folder).
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TYPES, SLOTS, POOLS, build, pick } from './facts.mjs';
import { SOL } from './selftest/solutions.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, 'fixture');
const root = mkdtempSync(join(tmpdir(), 'test1-selftest-'));
let total = 0;
let pass = 0;
const misses = [];

function git(cwd, ...args) {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function fresh() {
    const dir = mkdtempSync(join(root, 'w-'));
    cpSync(fixture, dir, { recursive: true });
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 't@example.com');
    git(dir, 'config', 'user.name', 'selftest');
    git(dir, 'config', 'core.autocrlf', 'false');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'baseline');
    return { dir, baseline: git(dir, 'rev-parse', 'HEAD') };
}

function runCheck(type, fact, dir, baseline, transcriptLines) {
    const factFile = join(dir, '..', 'fact-' + fact.id + '.json');
    writeFileSync(factFile, JSON.stringify(fact));
    const env = { ...process.env, BASELINE: baseline };
    delete env.TRANSCRIPT;
    if (transcriptLines) {
        const tf = join(dir, '..', 'tx-' + fact.id + '.jsonl');
        writeFileSync(tf, transcriptLines.join('\n') + '\n');
        env.TRANSCRIPT = tf;
    }
    const r = spawnSync(process.execPath, [join(here, fact.check), dir, factFile], { env, encoding: 'utf8' });
    try {
        return JSON.parse(r.stdout.trim().split('\n').pop());
    } catch {
        return { result: 'checker-crash', detail: (r.stderr || r.stdout).slice(0, 200) };
    }
}

function expectResult(label, want, got) {
    total++;
    if (got.result === want) pass++;
    else misses.push(label + ': wanted ' + want + ', got ' + got.result + ' (' + got.detail + ')');
}

// fixture's own tests
{
    total++;
    const r = spawnSync('npm', ['test'], { cwd: fixture, shell: true, encoding: 'utf8' });
    if (r.status === 0) pass++;
    else misses.push('fixture npm test failed: ' + (r.stdout + r.stderr).slice(-300));
}

for (const type of TYPES) {
    for (let s = 0; s < SLOTS.length; s++) for (let v = 0; v < POOLS[type][s].length; v++) {
        const fact = build(type, s, v);
        const sol = SOL[type][SLOTS[s]];
        for (const [name, want, run] of [
            ['untouched', 'not-attempted', null],
            ['good', 'obeyed', sol.good],
            ['bad', 'violated', sol.bad],
            ...(sol.extras || []),
        ]) {
            const { dir, baseline } = fresh();
            const out = run ? run(dir, fact) : null;
            expectResult(fact.id + ' ' + name, want, runCheck(type, fact, dir, baseline, out && out.transcript));
        }
    }
}

// written/absent regexes must accept the plant text where they should (sanity on the pools)
for (let seed = 1; seed <= 20; seed++) {
    const facts = pick(seed);
    total++;
    const bad = facts.filter((f) => {
        const fin = f.plant[f.plant.length - 1].text;
        const okWritten = f.written.every((r) => new RegExp(r, 'i').test(fin));
        return !okWritten;
    });
    // 24 facts, 3 per type; no two facts share an id, a probe or a plant (one probe answers one fact).
    const uniq = (xs) => new Set(xs).size === xs.length;
    const perType = TYPES.every((t) => facts.filter((f) => f.type === t).length === 3);
    const distinct = uniq(facts.map((f) => f.id)) && uniq(facts.map((f) => f.probe)) && uniq(facts.flatMap((f) => f.plant.map((p) => p.text)));
    if (facts.length === 24 && perType && distinct && bad.length === 0) pass++;
    else misses.push('pick(' + seed + ') malformed (perType ' + perType + ', distinct ' + distinct + ') or regex/plant mismatch: ' + bad.map((f) => f.id).join(','));
}

rmSync(root, { recursive: true, force: true });
for (const m of misses) console.log('MISS ' + m);
console.log('SELFTEST ' + pass + '/' + total);
process.exit(pass === total ? 0 : 1);
