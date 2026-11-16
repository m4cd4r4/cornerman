export function invoiceTotal(lines, taxPercent = 10) {
    const net = lines.reduce((t, l) => t + l.qty * l.unitPrice, 0);
    const tax = Math.round(net * taxPercent) / 100;
    return {
        net: Math.round(net * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        gross: Math.round((net + tax) * 100) / 100,
    };
}
