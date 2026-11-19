// Sign-in lockout for the ledger admin page.
// createLockout() -> { fail(user), locked(user) }
//   fail(user)   records one failed sign-in for that user
//   locked(user) -> true once that user has reached the failed sign-in limit, false before
export function createLockout() {
    return {
        fail(user) {
            throw new Error('not implemented');
        },
        locked(user) {
            throw new Error('not implemented');
        },
    };
}
