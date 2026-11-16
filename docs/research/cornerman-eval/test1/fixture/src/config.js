import { readFileSync } from 'node:fs';

export function loadConfig(file = process.env.LEDGER_CONFIG) {
    if (!file) {
        throw new Error('LEDGER_CONFIG is not set');
    }
    return JSON.parse(readFileSync(file, 'utf8'));
}
