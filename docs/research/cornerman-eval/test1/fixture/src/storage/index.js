import { openJsonl } from './jsonl.js';
import { openCsv } from './csv.js';

// Both stores expose append(entry) and all().
export function openStore(kind, file) {
    switch (kind) {
        case 'jsonl':
            return openJsonl(file);
        case 'csv':
            return openCsv(file);
        default:
            throw new Error('unknown store kind: ' + kind);
    }
}
