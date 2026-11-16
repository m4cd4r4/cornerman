import { appendFileSync, existsSync, readFileSync } from 'node:fs';

export function openJsonl(file) {
    return {
        append(entry) {
            appendFileSync(file, JSON.stringify(entry) + '\n');
        },
        all() {
            if (!existsSync(file)) {
                return [];
            }
            return readFileSync(file, 'utf8')
                .split('\n')
                .filter(Boolean)
                .map((line) => JSON.parse(line));
        },
    };
}
