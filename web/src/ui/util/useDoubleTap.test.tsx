import React from "react";
import useDoubleTap, {
  DOUBLE_TAP_TIMEOUT_MS,
  DoubleTapState,
} from "./useDoubleTap";
import { render } from "@testing-library/react";
import noop from "../../util/noop";
import { tap } from "../__test_util__/pointer";
import { advanceByTime } from "../__test_util__/time";

interface Props {
  onDoubleTap: () => void;
}

const DoubleTapTest: React.FC<Props> = ({ onDoubleTap }) => {
  const [ref, state] = useDoubleTap<HTMLDivElement>(onDoubleTap);

  return (
    <>
      <div ref={ref}>Touch Target</div>
      <div>{state}</div>
    </>
  );
};

it("reports none state with no interaction", () => {
  const cb = jest.fn();
  const { getByText } = render(<DoubleTapTest onDoubleTap={cb} />);
  expect(getByText(DoubleTapState.None)).toBeVisible();
});

it("reports waiting for tap after first tap", async () => {
  const { getByText, findByText } = render(
    <DoubleTapTest onDoubleTap={noop} />
  );
  const target = getByText("Touch Target");

  await tap(target, { action: "down" });
  expect(await findByText(DoubleTapState.WaitingForSecondTap)).toBeVisible();
});

it("returns to none after a short time after a tap", async () => {
  const { getByText, findByText } = render(
    <DoubleTapTest onDoubleTap={noop} />
  );
  const target = getByText("Touch Target");

  await tap(target, { action: "down" });
  jest.advanceTimersByTime(DOUBLE_TAP_TIMEOUT_MS + 1);
  expect(await findByText(DoubleTapState.None)).toBeVisible();
});

it("triggers the callback if double tapped in time", async () => {
  const cb = jest.fn();
  const { getByText, findByText } = render(<DoubleTapTest onDoubleTap={cb} />);
  const target = getByText("Touch Target");

  await tap(target);
  await tap(target, { action: "down" });
  expect(cb).toBeCalled();
  expect(await findByText(DoubleTapState.Active)).toBeVisible();
});

it("does not trigger the callback if the timeout expires", async () => {
  const cb = jest.fn();
  const { getByText } = render(<DoubleTapTest onDoubleTap={cb} />);
  const target = getByText("Touch Target");

  await tap(target);
  await advanceByTime(DOUBLE_TAP_TIMEOUT_MS + 1);
  await tap(target);
  expect(cb).not.toBeCalled();
});

it("reports the state as none after the second tap completes", async () => {
  const cb = jest.fn();
  const { getByText, findByText } = render(<DoubleTapTest onDoubleTap={cb} />);
  const target = getByText("Touch Target");

  await tap(target);
  await tap(target);
  expect(cb).toBeCalled();
  expect(await findByText(DoubleTapState.None)).toBeVisible();
});
