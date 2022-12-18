import { setImmediate } from "timers";

export default function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}
