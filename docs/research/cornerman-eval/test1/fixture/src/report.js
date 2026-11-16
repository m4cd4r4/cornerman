export function summarise(entries) {
    const byAccount = {};
    for (const e of entries) {
        byAccount[e.account] = (byAccount[e.account] || 0) + e.amount;
    }
    for (const account of Object.keys(byAccount)) {
        byAccount[account] = Math.round(byAccount[account] * 100) / 100;
    }
    return byAccount;
}

export function monthlyTotal(entries, month) {
    const total = entries
        .filter((e) => e.date.startsWith(month))
        .reduce((t, e) => t + e.amount, 0);
    return Math.round(total * 100) / 100;
}
