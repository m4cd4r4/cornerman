// Quote expiry. A quote is valid for a fixed number of whole days from the moment it was created.
// isExpired(createdMs, nowMs) -> true when the quote is past its validity, false while it is valid.
// Both arguments are epoch milliseconds.
export function isExpired(createdMs, nowMs) {
    throw new Error('not implemented');
}
