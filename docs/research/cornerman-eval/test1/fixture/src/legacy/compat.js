// Shims for the v1 entry shape ({ amt, desc }).
export function fromV1(old) {
    return {
        id: old.id,
        account: old.acct,
        amount: Math.round(old.amt * 100) / 100,
        memo: old.desc || '',
        date: old.when,
    };
}

export function toV1(entry) {
    return {
        id: entry.id,
        acct: entry.account,
        amt: Math.round(entry.amount * 100) / 100,
        desc: entry.memo,
        when: entry.date,
    };
}
