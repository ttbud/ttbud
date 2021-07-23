import Pos2d from "../../util/shape-math";
import { fireEvent } from "@testing-library/dom";
import { Buttons } from "../util/Buttons";
import { advanceByTime } from "./time";

type NonEmptyArray<T> = { 0: T } & Array<T>;

interface DragOpts {
  pointerType?: "mouse" | "touch" | "pen";
  buttons?: Buttons;
  shiftKey?: boolean;
}

export function drag(
  el: HTMLElement,
  [first, ...rest]: NonEmptyArray<Pos2d>,
  {
    pointerType = "mouse",
    buttons = Buttons.LEFT_MOUSE,
    shiftKey = false,
  }: DragOpts = {}
) {
  fireEvent.pointerDown(el, {
    pointerType,
    buttons,
    shiftKey,
    isPrimary: true,
    clientX: first.x,
    clientY: first.y,
  });

  for (const point of rest) {
    fireEvent.pointerMove(el, {
      pointerType,
      buttons,
      shiftKey,
      isPrimary: true,
      clientX: point.x,
      clientY: point.y,
    });
  }

  fireEvent.pointerUp(el);
}

interface TapOptions {
  action?: "down" | "up" | "both";
  pos?: Pos2d;
}

export async function tap(
  target: HTMLElement,
  { action = "both", pos = undefined }: TapOptions = {}
) {
  const posOptions = pos ? { clientX: pos.x, clientY: pos.y } : {};
  const options = { pointerType: "touch", isPrimary: true, ...posOptions };
  if (action === "down" || action === "both") {
    fireEvent.pointerDown(target, options);
    // useDoubleTap doesn't record the tap until the next run of the event loop to work around some inconsistencies in
    // browser implementations, so we have to wait for that to finish before continuing the test
    await advanceByTime(0);
  }

  if (action === "up" || action === "both") {
    fireEvent.pointerUp(target, options);
  }
}
