import throttle from "./throttle";

const THROTTLE_MS = 100;
let fn: jest.Mock, throttledFn: (...args: any[]) => void;

beforeEach(() => {
  fn = jest.fn();
  throttledFn = throttle(fn, THROTTLE_MS);
});

it("Should call functions immediately the first time", () => {
  throttledFn();
  expect(fn).toHaveBeenCalledTimes(1);
});

it("should forward arguments to the throttled function", () => {
  throttledFn("arg one", "arg two");
  expect(fn).toHaveBeenCalledWith("arg one", "arg two");
});

it("should only call once per interval", () => {
  // First call happens immediately, second call should be delayed until the interval is up
  throttledFn();
  throttledFn();

  expect(fn).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(THROTTLE_MS + 1);
  expect(fn).toHaveBeenCalledTimes(2);
});

it("Uses the most recent arguments when calls are dropped due to throttling", () => {
  throttledFn("first call");
  throttledFn("second call");
  throttledFn("third call");

  expect(fn).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(THROTTLE_MS + 1);
  expect(fn).toHaveBeenCalledTimes(2);
  expect(fn).toHaveBeenLastCalledWith("third call");
});
