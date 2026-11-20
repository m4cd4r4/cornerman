// Stress test plan for one seed: which facts, how each one is delivered, and when.
// plan(seed, set, { force }) -> { facts, steps, fillers, probes }
//   facts   28 probe targets: 3 per class A-H (Test 1's 24 targets), 3 class I, 1 class J
//   steps   what the driver sends, sorted by `at` = fraction of the W work turns already done
//           (0 = before the first work turn). kind: note | task | options | ops | survey | midturn
//   fillers class I volume: one standing rule after each work turn, in order
//   probes  fact ids in probe order: shuffled per seed, reversed (H) first, then D-ruling-A
// `set` is the wording set (set-dev.mjs; the held-out set is another file of the same shape).
// `force` = k picks variant k mod pool size everywhere: the floor variant check runs k = 0..5.
// Class C facts are finished at run time by resolveChoice(), from the options the agent wrote.
import { TYPES, SLOTS } from '../test1/facts.mjs';

const T1 = 'test1/checks/', ST = 'stress/checks/';
export const ORDINAL = ['first', 'second', 'third'];
const STEP_WORD = ['', '', '', 'three', 'four', 'five'];
// When each class is delivered. Design table: G at about 70-80%, H corrections at 85-91%, J at
// 5/30/55/80%. B-F are spread over the first 60% so every one of them crosses several clears.
const AT = {
    B: [0.10, 0.20, 0.30], C: [0.15, 0.25, 0.35], D: [0.12, 0.22, 0.32], E: [0.18, 0.28, 0.38], F: [0.40, 0.50, 0.60],
    G: [0.70, 0.80, 0.75], H: [0.85, 0.88, 0.91], J: [0.05, 0.30, 0.55, 0.80],
};
const MID_TURN_DELAY_MS = 8000;

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

// Test 1's build(), over the set's pools, with the checker path given from the eval root.
function mk(pools, type, s, v) {
    const f = pools[type][s][v];
    return {
        type, slot: SLOTS[s], id: type + '-' + SLOTS[s], variant: v,
        plant: f.plants || [{ phase: 'early', text: f.plant }],
        written: f.written, absent: f.absent || [], probe: f.probe,
        check: T1 + (f.check ? f.check.replace(/^checks\//, '') : type + '.mjs'),
        expect: f.expect,
    };
}

export function plan(seed, set, { force = null } = {}) {
    const rng = mulberry32(seed);
    const choose = (n) => (force == null ? Math.floor(rng() * n) : force % n);
    const facts = [], steps = [];
    const add = (cls, f) => { const fact = { cls, ...f, id: cls + '-' + f.id }; facts.push(fact); return fact; };
    const step = (at, kind, fact, rest) => steps.push({ at, kind, factId: fact.id, ...rest });
    const base = (cls, [type, s]) => add(cls, mk(set.pools, type, s, choose(set.pools[type][s].length)));

    // I first: the oldest standing rules, so a bounded rules log drops them before anything else.
    set.I.forEach((pool, i) => {
        const v = choose(pool.length), r = pool[v];
        const f = add('I', { type: 'numeric', slot: SLOTS[i], id: r.expect.kind, variant: v, plant: [{ phase: 'early', text: r.plant }], written: r.written, absent: [], probe: r.probe, check: ST + 'numeric.mjs', expect: r.expect });
        step(0, 'note', f, { text: r.plant });
    });
    for (const b of set.A) { const f = base('A', b); step(0, 'note', f, { text: f.plant[0].text }); }
    set.H.forEach((b, i) => {
        const f = base('H', b);
        step(0, 'note', f, { text: f.plant[0].text });
        step(AT.H[i], 'note', f, { text: f.plant[1].text });
    });
    {
        const v = choose(set.J.length), j = set.J[v];
        const f = add('J', { type: 'numeric', slot: 'A', id: j.expect.kind, variant: v, plant: j.plants.map((text) => ({ phase: 'chain', text })), written: j.written, absent: j.absent, probe: j.probe, check: ST + 'numeric.mjs', expect: j.expect });
        j.plants.forEach((text, i) => step(AT.J[i], 'note', f, { text }));
    }
    set.B.forEach((b, i) => { const f = base('B', b.base); step(AT.B[i], 'task', f, { text: b.task(f.plant[0].text) }); });
    set.C.forEach((c, i) => {
        const [type, s] = c.base;
        const shell = mk(set.pools, type, s, 0);
        const pick = choose(c.kind === 'number' ? 3 : c.options.length);
        const dynamic = c.kind === 'number' ? { kind: 'number', range: c.range, pick } : {
            kind: 'choice', pick, avoid: c.avoid,
            options: c.options.map((o) => {
                const v = set.pools[type][s].findIndex((x) => x.expect.want === o.want);
                const b = mk(set.pools, type, s, v);
                return { re: o.re, variant: v, written: b.written, expect: b.expect };
            }),
        };
        // expect and written are unknown until the agent has written its options.
        const f = add('C', { ...shell, variant: null, plant: [{ phase: 'early', text: c.ask }], written: null, expect: c.kind === 'number' ? { kind: shell.expect.kind, value: null } : null, dynamic });
        step(AT.C[i], 'options', f, { ask: c.ask, pickText: set.pick(ORDINAL[pick]) });
    });
    set.D.forEach((d, i) => {
        const f = base('D', d.base);
        if (d.written?.[f.variant]) f.written = d.written[f.variant];
        step(AT.D[i], 'ops', f, { topic: d.topic, body: 'ledger-ops report: ' + d.topic + '\n' + f.plant[0].text + '\n', text: set.opsText(d.topic) });
    });
    set.E.forEach((e, i) => {
        const ev = e.variants[choose(e.variants.length)];
        const [type, s] = e.base;
        const f = add('E', mk(set.pools, type, s, ev.baseVariant));
        step(AT.E[i], 'survey', f, { topic: e.topic, body: ev.body, ask: e.ask, verdict: ev.verdict, other: ev.other, confirm: set.accept });
    });
    set.F.forEach((fl, i) => {
        const v = choose(fl.variants.length), { doStep, text } = fl.variants[v], next = doStep + 1;
        const f = add('F', { type: 'in-flight', slot: SLOTS[i], id: 'in-flight-' + SLOTS[i], variant: v, plant: [{ phase: 'early', text }], written: [fl.written, 'step\\s*(' + next + '|' + STEP_WORD[next] + ')\\b'], absent: [], probe: fl.probe, check: T1 + 'in-flight.mjs', expect: { file: fl.file, step: next } });
        step(AT.F[i], 'task', f, { text });
    });
    set.G.forEach((b, i) => {
        const f = base('G', b);
        f.check = ST + 'ask-first.mjs';
        // The third is typed while a work turn is running.
        if (i === 2) step(AT.G[i], 'midturn', f, { text: f.plant[0].text, delayMs: MID_TURN_DELAY_MS });
        else step(AT.G[i], 'note', f, { text: f.plant[0].text });
    });

    steps.forEach((s, i) => { s.n = i; });
    steps.sort((a, b) => a.at - b.at || a.n - b.n);
    const t1 = facts.filter((f) => 'ABCDEFGH'.includes(f.cls));
    // Probe order: shuffled per seed, so a class is not tied to a position, and the same in every arm
    // (the plan does not know the arm). Its own generator, so the order never changes a variant choice.
    // The three reversed (H) probes still run first: they are style rules, and a file an earlier probe
    // wrote in the right style would show a later probe the answer.
    const order = [
        ...SLOTS.flatMap((slot) => TYPES.map((type) => t1.find((f) => f.type === type && f.slot === slot).id)),
        ...facts.filter((f) => f.cls === 'I' || f.cls === 'J').map((f) => f.id),
    ];
    const orderRng = mulberry32(seed ^ 0x9e3779b9);
    const shuffled = (xs) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(orderRng() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };
    // D-ruling-A runs straight after them (development trial 2, 2026-11-20): its probe adds a money
    // function that has to round, and in all three arms the agent built it on feeAt(), which an earlier
    // probe had put in src/money.js with floor rounding, so the repo answered it. Before any other money
    // probe, src/money.js is the fixture's, which rounds to nearest.
    const first = order.filter((id) => id === 'D-ruling-A');
    const probes = [...shuffled(order.filter((id) => id.startsWith('H-'))), ...first, ...shuffled(order.filter((id) => !id.startsWith('H-') && !first.includes(id)))];
    return { seed, set: set.name, force, facts, steps, fillers: set.fillers, probes };
}

// The numbered options in an agent reply: "1. ...", "2) ...", with or without list or bold marks.
export function optionLines(reply) {
    const out = [];
    for (const line of String(reply).split('\n')) {
        const m = line.match(/^\s*(?:[-*>]\s*)?(?:\*\*)?\s*(\d)[.)]\s*(.+)$/);
        if (m) out[Number(m[1]) - 1] = m[2];
    }
    return out;
}

// Class C: finish the fact from the options the agent wrote. Returns the fact with `expect` and
// `written` set, or null when the reply cannot be read (plant invalid: excluded and reported).
export function resolveChoice(fact, reply) {
    const d = fact.dynamic, lines = optionLines(reply);
    const want = d.kind === 'number' ? 3 : d.options.length;
    if (lines.length !== want || lines.includes(undefined)) return null;
    if (d.kind === 'number') {
        const values = lines.map((l) => Number((l.match(/\d+/) || [])[0]));
        const [lo, hi] = d.range;
        const ok = values.every((v) => Number.isInteger(v) && v >= lo && v <= hi && v % 5 !== 0) && new Set(values).size === 3;
        if (!ok) return null;
        const value = values[d.pick];
        return { ...fact, variant: d.pick, written: ['\\b' + value + '\\b'], expect: { ...fact.expect, value }, resolved: { options: values, pick: d.pick } };
    }
    // An option is named at the start of its line. Its argument may name the other one ("1. All upper
    // case: ... easy to tell apart from lower-case fields" made the plant invalid in floor run 5).
    const head = (l) => l.replace(/[*_`]/g, '').slice(0, 24);
    const matched = lines.map((l) => d.options.filter((o) => new RegExp(o.re, 'i').test(head(l))));
    if (matched.some((m) => m.length !== 1) || new Set(matched.map((m) => m[0])).size !== matched.length) return null;
    // `avoid` is the option an untold agent takes anyway (floor variant check): the user picks the
    // other one, wherever the agent listed it. The driver words the pick from resolved.pick.
    const pick = d.avoid ? matched.findIndex((m) => m[0].expect.want !== d.avoid) : d.pick;
    const o = matched[pick][0];
    return { ...fact, variant: o.variant, written: o.written, expect: o.expect, resolved: { options: matched.map((m) => m[0].expect.want), pick } };
}

// The last text block the agent wrote in a list of transcript entries. A turn that runs a tool
// often opens with a line like "Let me run that." in an earlier block; the answer is the last one.
export function lastText(entries) {
    return entries.filter((e) => e.type === 'assistant' && Array.isArray(e.message?.content))
        .flatMap((e) => e.message.content.filter((p) => p.type === 'text' && p.text.trim()).map((p) => p.text)).at(-1) ?? '';
}

// Class E: the verdict is the first line of the reply (its last text block). It must name the expected option alone.
export function verdictOk(step, reply) {
    const first = String(reply).split('\n').map((l) => l.replace(/[*_`#>]/g, '').trim()).find(Boolean) || '';
    return new RegExp(step.verdict, 'i').test(first) && !new RegExp(step.other, 'i').test(first);
}
