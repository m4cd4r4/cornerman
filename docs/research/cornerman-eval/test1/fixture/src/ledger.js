import { add, isValidAmount } from './money.js';

export class Ledger {
    constructor(store) {
        this.store = store;
        this.nextId = store.all().length + 1;
    }

    record(account, amount, memo = '', date = '2026-01-01') {
        if (!isValidAmount(amount)) {
            throw new TypeError('amount must be a finite number');
        }
        const entry = { id: this.nextId++, account, amount, memo, date };
        this.store.append(entry);
        return entry;
    }

    balance(account) {
        return this.store
            .all()
            .filter((e) => e.account === account)
            .reduce((total, e) => add(total, e.amount), 0);
    }
}
