// Shared helpers for the acted-on checkers.
// Contract: node checks/<x>.mjs <workdir> <factJSON-file>; env BASELINE (sha), TRANSCRIPT (jsonl path).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function init() {
    const [workdir, factFile] = process.argv.slice(2);
    if (!workdir || !factFile) {
        report('not-attempted', 'usage: <workdir> <factJSON-file>');
    }
    return {
        workdir,
        fact: JSON.parse(readFileSync(factFile, 'utf8')),
        baseline: process.env.BASELINE || 'HEAD',
        transcript: process.env.TRANSCRIPT || '',
    };
}

export function report(result, detail) {
    console.log(JSON.stringify({ result, detail }));
    process.exit(0);
}

export function git(workdir, args) {
    return execFileSync('git', args, {
        cwd: workdir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
}

const lines = (s) => s.split('\n').map((l) => l.replace(/\r$/, '')).filter(Boolean);

function untracked(workdir) {
    return lines(git(workdir, ['ls-files', '--others', '--exclude-standard']));
}

// Files changed (tracked diff vs baseline, plus untracked), forward slashes.
export function changedFiles(workdir, baseline) {
    const tracked = lines(git(workdir, ['diff', '--name-only', baseline]));
    return [...new Set([...tracked, ...untracked(workdir)])].map((p) => p.replace(/\\/g, '/'));
}

// Added lines of one file versus baseline (every line, for an untracked file).
export function addedLines(workdir, baseline, file) {
    if (untracked(workdir).includes(file)) {
        return readFileSync(join(workdir, file), 'utf8').split('\n').map((l) => l.replace(/\r$/, ''));
    }
    const diff = git(workdir, ['diff', '-U0', baseline, '--', file]);
    return diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1).replace(/\r$/, ''));
}

export function showBaseline(workdir, baseline, file) {
    try {
        return git(workdir, ['show', baseline + ':' + file]);
    } catch {
        return '';
    }
}
