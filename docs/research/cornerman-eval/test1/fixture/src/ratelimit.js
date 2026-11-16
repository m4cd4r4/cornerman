// Per-client request limiter. Fixed one-minute window per client id.
// `now` returns the current time in milliseconds (injectable for tests).
export function createLimiter({ now = Date.now } = {}) {
    return {
        // allow(clientId) -> true when the request may proceed, false when it is over the limit
        allow(clientId) {
            throw new Error('not implemented');
        },
    };
}
