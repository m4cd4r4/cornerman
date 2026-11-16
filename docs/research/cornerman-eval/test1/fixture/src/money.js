// Money helpers. Amounts are plain numbers in the ledger's currency.

export function round2(value) {
    return Math.round(value * 100) / 100;
}

export function add(a, b) {
    return round2(a + b);
}

export function sum(values) {
    return values.reduce((total, v) => add(total, v), 0);
}

export function percentOf(amount, percent) {
    return round2((amount * percent) / 100);
}

export function isValidAmount(amount) {
    return typeof amount === 'number' && Number.isFinite(amount);
}
