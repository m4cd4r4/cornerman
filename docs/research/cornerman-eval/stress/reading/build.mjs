#!/usr/bin/env node
// Builds the reading corpus for the stress test's work turns: the Node.js API docs of one pinned
// release, cut at headings into files of about 10 KB (about 2,500 tokens), so 6 files a turn add
// about 15k tokens and 50 turns reach the 800k the full arm needs. The image alone holds about 1 MB.
//   node build.mjs <out-dir>
// Writes r0001-<module>.md ..., index.txt (the order the driver reads in: modules interleaved, so
// every stretch of turns mixes them) and manifest.json (source, sizes, sha256 of every file).
// Same input and same code give the same files: the manifest's `sha256` of index + files proves it.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VERSION = 'v22.11.0';
const SOURCE = 'https://nodejs.org/dist/' + VERSION + '/docs/api/';
const MODULES = ['addons', 'assert', 'async_context', 'buffer', 'child_process', 'cli', 'cluster', 'crypto', 'deprecations', 'dgram', 'diagnostics_channel', 'dns', 'domain',
    'errors', 'esm', 'events', 'fs', 'globals', 'http', 'http2', 'https', 'inspector', 'intl', 'modules', 'n-api', 'net', 'os', 'packages', 'path', 'perf_hooks',
    'permissions', 'process', 'querystring', 'readline', 'repl', 'report', 'stream', 'string_decoder', 'test', 'timers', 'tls', 'tty', 'url', 'util', 'v8', 'vm',
    'wasi', 'webcrypto', 'webstreams', 'worker_threads', 'zlib'];
const TARGET = 10_000, MAX = 13_000;
const out = process.argv[2];
if (!out) { console.error('usage: node build.mjs <out-dir>'); process.exit(2); }
mkdirSync(out, { recursive: true });
const sha = (s) => createHash('sha256').update(s).digest('hex');

// Cut at "## " and "### " headings; a part closes once it reaches TARGET, and a single section
// longer than MAX is cut at a line end.
function parts(text) {
    const res = [];
    let cur = '';
    const push = () => { if (cur.trim()) res.push(cur); cur = ''; };
    for (const line of text.split('\n')) {
        if (/^#{2,3} /.test(line) && cur.length >= TARGET) push();
        if (cur.length + line.length > MAX) push();
        cur += line + '\n';
    }
    push();
    // A short tail joins the part before it.
    if (res.length > 1 && res.at(-1).length < TARGET / 3) res.splice(-2, 2, res.at(-2) + res.at(-1));
    return res;
}

const perModule = [];
for (const m of MODULES) {
    const r = await fetch(SOURCE + m + '.md');
    if (!r.ok) throw new Error(m + ': HTTP ' + r.status);
    const text = (await r.text()).replace(/\r\n/g, '\n');
    perModule.push({ m, source: sha(text), parts: parts(text) });
}
// Interleave: part 1 of every module, then part 2 of every module that has one, and so on.
const files = [];
for (let i = 0; perModule.some((x) => i < x.parts.length); i++) for (const x of perModule) if (i < x.parts.length) files.push({ m: x.m, text: x.parts[i] });
const index = [], manifest = { source: SOURCE, version: VERSION, modules: Object.fromEntries(perModule.map((x) => [x.m, x.source])), files: {} };
files.forEach((f, i) => {
    const name = 'r' + String(i + 1).padStart(4, '0') + '-' + f.m + '.md';
    writeFileSync(join(out, name), f.text);
    index.push(name);
    manifest.files[name] = { bytes: Buffer.byteLength(f.text), sha256: sha(f.text) };
});
writeFileSync(join(out, 'index.txt'), index.join('\n') + '\n');
const sizes = Object.values(manifest.files).map((f) => f.bytes);
manifest.count = index.length;
manifest.bytes = sizes.reduce((a, b) => a + b, 0);
manifest.sha256 = sha(index.map((n) => n + ' ' + manifest.files[n].sha256).join('\n'));
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(index.length + ' files, ' + Math.round(manifest.bytes / 1024) + ' KB, smallest ' + Math.min(...sizes) + ', largest ' + Math.max(...sizes) + ', sha256 ' + manifest.sha256);
