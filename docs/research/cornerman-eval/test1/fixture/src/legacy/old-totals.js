// Totals as computed by the v1 client. Kept for callers that still import it.
export function legacyTotal(amounts) {
    let total = 0;
    for (const a of amounts) {
        total += a;
    }
    return Math.round(total * 100) / 100;
}

export function legacyAverage(amounts) {
    if (amounts.length === 0) {
        return 0;
    }
    return Math.round((legacyTotal(amounts) / amounts.length) * 100) / 100;
}
