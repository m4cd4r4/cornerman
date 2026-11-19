// Retry wrapper for calls to the bank feed.
// withRetry(fn) -> calls the async function fn and resolves with its result. When fn rejects it is
// called again, with no delay, until the attempt limit is reached; then the last error is rethrown.
export async function withRetry(fn) {
    throw new Error('not implemented');
}
