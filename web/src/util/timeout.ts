/**
 * Create a promise that resolves in timeMs milliseconds
 */
export default function timeout(timeMs: number) {
  return new Promise(resolve => {
    window.setTimeout(resolve, timeMs);
  });
}
