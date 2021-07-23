import React from "react";
import useLongTap, { LONG_TAP_MS, MAX_MOVE_LONG_TAP_PX } from "./useLongTap";
import { render } from "@testing-library/react";
import { tap } from "../__test_util__/pointer";
import { advanceByTime } from "../__test_util__/time";
import { fireEvent } from "@testing-library/dom";

interface Props {
  onLongTap: () => void;
}

const LongTapTest: React.FC<Props> = ({ onLongTap }) => {
  const ref = useLongTap<HTMLDivElement>(onLongTap);

  return <div ref={ref}>Touch Target</div>;
};

it("does not trigger for short taps", async () => {
  const cb = jest.fn();
  const { getByText } = render(<LongTapTest onLongTap={cb} />);
  await tap(getByText("Touch Target"));
  expect(cb).not.toBeCalled();
});

it("triggers for long taps", async () => {
  const cb = jest.fn();
  const { getByText } = render(<LongTapTest onLongTap={cb} />);
  await tap(getByText("Touch Target"), { action: "down" });
  await advanceByTime(LONG_TAP_MS + 1);
  expect(cb).toBeCalled();
});

it("does not trigger for drags", async () => {
  const cb = jest.fn();
  const { getByText } = render(<LongTapTest onLongTap={cb} />);
  const target = getByText("Touch Target");
  await tap(target, { action: "down", pos: { x: 0, y: 0 } });
  await fireEvent.pointerMove(target, {
    pointerType: "touch",
    isPrimary: true,
    clientX: MAX_MOVE_LONG_TAP_PX + 1,
    clientY: MAX_MOVE_LONG_TAP_PX + 1,
  });
  await advanceByTime(LONG_TAP_MS + 1);
  expect(cb).not.toBeCalled();
});
