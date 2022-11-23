import { BoardState, pingAt, tokenIdAt } from "./board-state";
import Pos2d, { posAreEqual, snapToGrid } from "../../util/shape-math";
import React, {
  CSSProperties,
  PointerEventHandler,
  useCallback,
  useRef,
  useState,
} from "react";
import { CHARACTER_HEIGHT, FLOOR_HEIGHT } from "./board-slice";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import { GRID_SIZE_PX } from "../../config";
import useDoubleTap, { DoubleTapState } from "../util/useDoubleTap";
import useLongTap from "../util/useLongTap";
import { Buttons } from "../util/Buttons";
import PureBoard from "./PureBoard";
import mergeRefs from "../../util/mergeRefs";
import { useDroppable } from "@dnd-kit/core";
import { DROPPABLE_IDS } from "../DroppableIds";

type DivRef = (element: HTMLDivElement | null) => void;

interface Props {
  boardState: BoardState;
  onDraw(pos: Pos2d): void;
  onPing(pos: Pos2d): void;
  onDelete(tokenId: string): void;
}

type PointerAction = "delete" | "ping" | "draw" | "ignore";

function topTokenIdAt(boardState: BoardState, gridPos: Pos2d) {
  let tokenId = tokenIdAt(boardState, {
    ...gridPos,
    z: CHARACTER_HEIGHT,
  });
  if (!tokenId) {
    tokenId = tokenIdAt(boardState, {
      ...gridPos,
      z: FLOOR_HEIGHT,
    });
  }
  return tokenId;
}

const scrolledPos = (pixelPos: Pos2d) => {
  return {
    x: pixelPos.x + document.documentElement.scrollLeft,
    y: pixelPos.y + document.documentElement.scrollTop,
  };
};

const toGridPos = (pixelPos: Pos2d) => {
  const snappedPixelPos = snapToGrid(scrolledPos(pixelPos));
  return {
    x: snappedPixelPos.x / GRID_SIZE_PX,
    y: snappedPixelPos.y / GRID_SIZE_PX,
  };
};

type Mode = "draw" | "delete";

const useBoardInputMonitor = ({
  boardState,
  onDraw,
  onPing,
  onDelete,
}: Props) => {
  const [mode, setMode] = useState<Mode>("draw");
  const { active, setNodeRef } = useDroppable({ id: DROPPABLE_IDS.BOARD });
  const droppableRef: DivRef = setNodeRef;
  const isDragging = active !== null;

  const handlePointerAction = useCallback(
    (action: PointerAction, gridPos: Pos2d, allowDuplicatePings: boolean) => {
      switch (action) {
        case "ping":
          if (allowDuplicatePings || !pingAt(boardState, gridPos)) {
            onPing(gridPos);
          }
          break;
        case "draw":
          const pos = { ...gridPos, z: FLOOR_HEIGHT };
          if (!tokenIdAt(boardState, pos)) {
            onDraw(gridPos);
          }
          break;
        case "delete":
          let toDeleteId = topTokenIdAt(boardState, gridPos);
          if (toDeleteId) {
            onDelete(toDeleteId);
          }
          break;
        case "ignore":
          break;
        /* istanbul ignore next */
        default:
          throw new UnreachableCaseError(action);
      }
    },
    [onPing, onDraw, onDelete, boardState]
  );

  const onDoubleTap = useCallback(
    (e: PointerEvent) => {
      if (isDragging) return;

      const gridPos = toGridPos({ x: e.clientX, y: e.clientY });
      const tokenId = topTokenIdAt(boardState, gridPos);
      if (tokenId) {
        onDelete(tokenId);
        setMode("delete");
      } else {
        onDraw(gridPos);
      }
    },
    [isDragging, boardState, onDelete, onDraw]
  );

  const [doubleTapRef, doubleTapState] =
    useDoubleTap<HTMLDivElement>(onDoubleTap);

  const onLongTap = useCallback(
    (e: PointerEvent) => {
      if (isDragging || doubleTapState === DoubleTapState.Active) return;

      const gridPos = toGridPos({ x: e.clientX, y: e.clientY });
      onPing(gridPos);
    },
    [isDragging, doubleTapState, onPing]
  );

  const container = useRef<HTMLDivElement>(null);
  const longTapRef = useLongTap<HTMLDivElement>(onLongTap);

  const getTouchAction = (): PointerAction => {
    if (doubleTapState !== DoubleTapState.Active) {
      return "ignore";
    }

    return mode;
  };

  const getMouseAction = (e: React.PointerEvent): PointerAction => {
    if (e.shiftKey && e.buttons === Buttons.LEFT_MOUSE) {
      return "ping";
    } else if (e.buttons === Buttons.LEFT_MOUSE) {
      return "draw";
    } else if (e.buttons === Buttons.RIGHT_MOUSE) {
      return "delete";
    } else {
      return "ignore";
    }
  };

  const getPointerAction = (e: React.PointerEvent): PointerAction => {
    if (isDragging) return "ignore";

    switch (e.pointerType) {
      case "pen":
        return "draw";
      case "touch":
        return getTouchAction();
      default:
        return getMouseAction(e);
    }
  };

  const onPointerDown: PointerEventHandler = (e) => {
    const action = getPointerAction(e);

    // Stop pen users from scrolling with their pen
    if (e.pointerType === "pen") e.preventDefault();

    const gridPos = toGridPos({ x: e.clientX, y: e.clientY });
    handlePointerAction(action, gridPos, true);
  };

  const onPointerMove: PointerEventHandler = (e) => {
    // Stop pen users from scrolling with their pen
    if (e.pointerType === "pen") e.preventDefault();

    // Pointer events are only triggered once per frame, but if the mouse is
    // moving quickly it can actually move over an entire grid square in less
    // than a frame's time, so we'll miss drawing walls in certain places. In
    // browsers that support it, we can request all of the mouse move events
    // since the last frame, and then batch process those
    let events: PointerEvent[];
    if (e.nativeEvent.getCoalescedEvents) {
      events = e.nativeEvent.getCoalescedEvents();
      // Firefox has a bug where sometimes coalesced events is empty
      if (events.length === 0) {
        events = [e.nativeEvent];
      }
    } else {
      events = [e.nativeEvent];
    }

    const processedPositions: Pos2d[] = [];
    for (const event of events) {
      const action = getPointerAction(e);
      const { clientX: x, clientY: y } = event;
      const gridPos = toGridPos({ x, y });
      // Skip mouse events that result in the same grid position
      if (processedPositions.some((pos) => posAreEqual(pos, gridPos))) {
        continue;
      }
      handlePointerAction(action, gridPos, false);
      processedPositions.push(gridPos);
    }
  };

  const onPointerUp = () => {
    setMode("draw");
  };

  // If we're going to touch draw, disable touch scrolling
  // We disable touch scrolling before even getting to the second tap because for some browsers once the gesture has
  // started we can no longer interrupt the panning.
  const touchAction =
    doubleTapState === DoubleTapState.Active ||
    doubleTapState === DoubleTapState.WaitingForSecondTap
      ? "none"
      : "auto";

  // I apologize for future readers, this is a massive hack
  // Safari doesn't notice that we've changed the touchAction back to "auto" after a long draw _unless_ you also change
  // another css property at the same time
  // Before you ask, yes it's only in mobile safari and yes I have no idea why it happens or why this fixes it. And
  // finally, yes I realize I have committed an unforgivable sin
  const borderHack =
    touchAction === "none" ? "0px solid red" : "0px solid blue";

  const style: CSSProperties = { touchAction, border: borderHack };

  return {
    ref: mergeRefs(container, doubleTapRef, longTapRef, droppableRef),
    style,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
};

export { toGridPos };
export default useBoardInputMonitor;
