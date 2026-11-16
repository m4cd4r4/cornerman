import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportEntries } from '../src/export.js';
import { summarise, monthlyTotal } from '../src/report.js';
import { invoiceTotal } from '../src/invoice.js';

const entries = [
    { id: 1, account: 'cash', amount: 10, memo: 'a, b', date: '2026-03-04' },
    { id: 2, account: 'bank', amount: 2.5, memo: '', date: '2026-03-09' },
];

test('exportEntries writes one line per entry', () => {
    assert.equal(exportEntries(entries), '1,cash,10,"a, b",04/03/2026\n2,bank,2.5,,09/03/2026\n');
});

test('report totals', () => {
    assert.deepEqual(summarise(entries), { cash: 10, bank: 2.5 });
    assert.equal(monthlyTotal(entries, '2026-03'), 12.5);
});

test('invoiceTotal adds tax', () => {
    assert.deepEqual(invoiceTotal([{ qty: 2, unitPrice: 50 }]), { net: 100, tax: 10, gross: 110 });
});
