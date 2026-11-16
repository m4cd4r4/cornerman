import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const FIELDS = ['id', 'account', 'amount', 'memo', 'date'];

function quote(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function parseLine(line) {
    const cells = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') {
                cell += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                cell += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            cells.push(cell);
            cell = '';
        } else {
            cell += ch;
        }
    }
    cells.push(cell);
    return cells;
}

export function openCsv(file) {
    return {
        append(entry) {
            appendFileSync(file, FIELDS.map((f) => quote(entry[f])).join(',') + '\n');
        },
        all() {
            if (!existsSync(file)) {
                return [];
            }
            return readFileSync(file, 'utf8')
                .split('\n')
                .filter(Boolean)
                .map((line) => {
                    const cells = parseLine(line);
                    const entry = {};
                    FIELDS.forEach((f, i) => {
                        entry[f] = f === 'amount' ? Number(cells[i]) : cells[i];
                    });
                    return entry;
                });
        },
    };
}
