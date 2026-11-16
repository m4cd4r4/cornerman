import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Ledger } from '../src/ledger.js';
import { openStore } from '../src/storage/index.js';

for (const kind of ['jsonl', 'csv']) {
    test('ledger records and balances on the ' + kind + ' store', () => {
        const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
        const file = join(dir, 'entries.' + kind);
        const ledger = new Ledger(openStore(kind, file));
        ledger.record('cash', 10.5, 'float, "quoted"');
        ledger.record('cash', 2.25);
        ledger.record('bank', 5);
        assert.equal(ledger.balance('cash'), 12.75);
        const reopened = new Ledger(openStore(kind, file));
        assert.equal(reopened.balance('bank'), 5);
        assert.equal(reopened.store.all()[0].memo, 'float, "quoted"');
    });
}

test('record rejects non-numbers', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
    const ledger = new Ledger(openStore('jsonl', join(dir, 'e.jsonl')));
    assert.throws(() => ledger.record('cash', 'ten'), TypeError);
});
