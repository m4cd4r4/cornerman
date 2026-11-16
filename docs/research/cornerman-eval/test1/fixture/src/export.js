import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_FILENAME = 'export.csv';
const FIELDS = ['id', 'account', 'amount', 'memo', 'date'];

function formatDate(iso) {
    const [y, m, d] = iso.split('-');
    return d + '/' + m + '/' + y;
}

function cell(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export function exportEntries(entries) {
    const lines = entries.map((e) =>
        FIELDS.map((f) => cell(f === 'date' ? formatDate(e.date) : e[f])).join(',')
    );
    return lines.join('\n') + '\n';
}

export function writeExport(entries, dir, filename = DEFAULT_FILENAME) {
    mkdirSync(dir, { recursive: true });
    const target = join(dir, filename);
    writeFileSync(target, exportEntries(entries));
    return target;
}
