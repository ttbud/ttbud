/**
 * This error class just exists to tell the compiler that a
 * line should never be reached, so the compiler can enforce
 * that by doing exhaustiveness checks in switch statements
 *
 * @see http://ideasintosoftware.com/exhaustive-switch-in-typescript/
 */
export default class UnreachableCaseError extends Error {
    constructor(val: never) {
        super(`Unreachable case: ${val}`);
    }
}
