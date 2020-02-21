/**
 * This error class just exists to tell the compiler that a
 * line should never be reached, so the compiler can enforce
 * that by doing exhaustiveness checks in switch statements
 *
 * @see http://ideasintosoftware.com/exhaustive-switch-in-typescript/
 */
export default class UnreachableCaseError extends Error {
  // The whole point of this class is that it should be
  // impossible to ever call
  /* istanbul ignore next */
  constructor(val: never) {
    super(`Unreachable case: ${val}`);
  }
}
