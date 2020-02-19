type AnyVoidFn<A extends any[]> = (...args: A) => void;

/**
 * Call the provided function at most once every timeMs milliseconds
 */
export default function throttle<A extends any[]>(
  fn: AnyVoidFn<A>,
  timeMs: number
): AnyVoidFn<A> {
  let lastInvocationTime = 0;
  let timeoutId: number | undefined;

  return (...args: A) => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }

    const invokeFn = () => {
      lastInvocationTime = Date.now();
      timeoutId = undefined;
      fn.apply(undefined, args);
    };

    const elapsedMs = Date.now() - lastInvocationTime;
    const timeUntilNextCallMs = timeMs - elapsedMs;
    if (timeUntilNextCallMs <= 0) {
      invokeFn();
    } else {
      timeoutId = window.setTimeout(invokeFn, timeUntilNextCallMs);
    }
  };
}
