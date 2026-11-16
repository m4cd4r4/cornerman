import { test } from 'node:test';
import assert from 'node:assert/strict';
import { add, sum, percentOf, round2, isValidAmount } from '../src/money.js';

test('round2 rounds to two decimals', () => {
    assert.equal(round2(1.0051), 1.01);
    assert.equal(round2(2.5), 2.5);
});

test('add and sum', () => {
    assert.equal(add(0.1, 0.2), 0.3);
    assert.equal(sum([1.1, 2.2, 3.3]), 6.6);
});

test('percentOf', () => {
    assert.equal(percentOf(200, 10), 20);
});

test('isValidAmount', () => {
    assert.equal(isValidAmount(3), true);
    assert.equal(isValidAmount(NaN), false);
});
