import { act } from "@testing-library/react";
import flushPromises from "../../util/flushPromises";

export async function advanceByTime(timeMs: number) {
  await act(async () => {
    jest.advanceTimersByTime(timeMs);
    // Run any pending tasks that happen after the timers complete
    await flushPromises();
  });
}
