import Pos2d from "../../util/shape-math";
import { fireEvent } from "@testing-library/dom";
import { Buttons } from "../util/Buttons";

type NonEmptyArray<T> = { 0: T } & Array<T>;

interface DragOpts {
  buttons?: Buttons;
  shiftKey?: boolean;
}

export function drag(
  el: HTMLElement,
  [first, ...rest]: NonEmptyArray<Pos2d>,
  { buttons = Buttons.LEFT_MOUSE, shiftKey = false }: DragOpts = {}
) {
  fireEvent.pointerDown(el, {
    buttons,
    shiftKey,
    clientX: first.x,
    clientY: first.y,
  });

  for (const point of rest) {
    fireEvent.pointerMove(el, {
      buttons,
      shiftKey,
      clientX: point.x,
      clientY: point.y,
    });
  }

  fireEvent.pointerUp(el);
}
