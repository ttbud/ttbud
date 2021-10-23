import React, {
  MouseEventHandler,
  PointerEventHandler,
  useCallback,
  useRef,
  useState,
} from "react";
import makeStyles from "@mui/styles/makeStyles";
import { GRID_SIZE_PX } from "../../config";
import Floor from "../token/Floor";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import Ping from "../token/Ping";
import Pos2d, {
  centerOf,
  posAreEqual,
  snapToGrid,
} from "../../util/shape-math";
import { DROPPABLE_IDS } from "../DroppableIds";
import { TransitionGroup } from "react-transition-group";
import Fade from "../transition/Fade";
import NoopTransition from "../transition/NoopTransition";
import {
  addPing,
  CHARACTER_HEIGHT,
  FLOOR_HEIGHT,
  removeEntity,
  upsertToken,
} from "./board-slice";
import { EntityType, TokenContents } from "../../types";
import { BoardState, pingAt, tokenIdAt } from "./board-state";
import { Buttons } from "../util/Buttons";
import useDoubleTap, { DoubleTapState } from "../util/useDoubleTap";
import useLongTap from "../util/useLongTap";
import mergeRefs from "../../util/mergeRefs";
import { useDroppable } from "@dnd-kit/core";
import Draggable from "../drag/Draggable";
import Character from "../token/Character";
import useDropMonitor from "../drag/useDropMonitor";
import { v4 as uuid } from "uuid";
import { shallowEqual, useDispatch, useSelector } from "react-redux";
import { RootState } from "../../store/rootReducer";

let GRID_COLOR = "#947C65";

const useStyles = makeStyles((theme) => ({
  container: {
    width: "100%",
    height: "100%",
  },
  board: {
    // Otherwise safari will try to "select" the empty text next to each floor icon
    userSelect: "none",
    backgroundColor: theme.palette.background.default,
    backgroundImage: `repeating-linear-gradient(
      0deg,
      transparent,
      transparent ${GRID_SIZE_PX - 1}px,
      ${GRID_COLOR} ${GRID_SIZE_PX - 1}px,
      ${GRID_COLOR} ${GRID_SIZE_PX}px
    ),
    repeating-linear-gradient(
      -90deg,
      transparent,
      transparent ${GRID_SIZE_PX - 1}px,
      ${GRID_COLOR} ${GRID_SIZE_PX - 1}px,
      ${GRID_COLOR} ${GRID_SIZE_PX}px
    )`,
    borderBottom: `1px solid ${GRID_COLOR}`,
    borderRight: `1px solid ${GRID_COLOR}`,
    backgroundSize: `${GRID_SIZE_PX}px ${GRID_SIZE_PX}px`,
    height: "100%",
    width: "100%",
    zIndex: 0,
  },
}));

type PointerAction = "delete" | "ping" | "draw" | "ignore";

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

const preventDefault: MouseEventHandler = (e) => e.preventDefault();

interface Props {
  droppableRef: DivRef;
  isDragging: boolean;
}

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

type Mode = "draw" | "delete";

interface SelectedState {
  boardState: BoardState;
  activeFloor: TokenContents;
}

const PureBoard: React.FC<Props> = React.memo(
  ({ droppableRef, isDragging }) => {
    const classes = useStyles();

    const [mode, setMode] = useState<Mode>("draw");

    const { boardState, activeFloor } = useSelector<RootState, SelectedState>(
      (state) => ({
        boardState: state.board.local,
        activeFloor: state.floorTray.activeFloor,
      }),
      shallowEqual
    );

    const dispatch = useDispatch();

    useDropMonitor("board", (event) => {
      switch (event.type) {
        case "dragged from":
          dispatch(removeEntity(event.dragId));
          break;
        case "dropped into":
        case "moved inside":
          const pos = {
            ...toGridPos(centerOf(event.rect)),
            z: CHARACTER_HEIGHT,
          };
          dispatch(
            upsertToken({
              type: EntityType.Character,
              pos,
              id: event.dragId,
              contents: event.descriptor.contents,
            })
          );
          break;
        default:
          throw new UnreachableCaseError(event);
      }
    });

    const handlePointerAction = useCallback(
      (action: PointerAction, gridPos: Pos2d, allowDuplicatePings: boolean) => {
        switch (action) {
          case "ping":
            if (allowDuplicatePings || !pingAt(boardState, gridPos)) {
              dispatch(addPing(gridPos));
            }
            break;
          case "draw":
            const pos = { ...gridPos, z: FLOOR_HEIGHT };
            if (!tokenIdAt(boardState, pos)) {
              dispatch(
                upsertToken({
                  id: uuid(),
                  pos,
                  type: EntityType.Floor,
                  contents: activeFloor,
                })
              );
            }
            break;
          case "delete":
            let toDeleteId = topTokenIdAt(boardState, gridPos);
            if (toDeleteId) {
              dispatch(removeEntity(toDeleteId));
            }
            break;
          case "ignore":
            break;
          /* istanbul ignore next */
          default:
            throw new UnreachableCaseError(action);
        }
      },
      [activeFloor, boardState, dispatch]
    );

    const onDoubleTap = useCallback(
      (e: PointerEvent) => {
        if (isDragging) return;

        const gridPos = toGridPos({ x: e.clientX, y: e.clientY });
        const tokenId = topTokenIdAt(boardState, gridPos);
        if (tokenId) {
          dispatch(removeEntity(tokenId));
          setMode("delete");
        } else {
          dispatch(
            upsertToken({
              id: uuid(),
              type: EntityType.Floor,
              pos: { ...gridPos, z: FLOOR_HEIGHT },
              contents: activeFloor,
            })
          );
        }
      },
      [isDragging, activeFloor, boardState, dispatch]
    );

    const [doubleTapRef, doubleTapState] =
      useDoubleTap<HTMLDivElement>(onDoubleTap);

    const onLongTap = useCallback(
      (e: PointerEvent) => {
        if (isDragging || doubleTapState === DoubleTapState.Active) return;

        const gridPos = toGridPos({ x: e.clientX, y: e.clientY });
        dispatch(addPing(gridPos));
      },
      [isDragging, doubleTapState, dispatch]
    );

    const container = useRef<HTMLDivElement>(null);
    const longTapRef = useLongTap<HTMLDivElement>(onLongTap);

    const tokenIcons = Object.values(boardState.entityById).map((token) => {
      const pixelPos = {
        x: token.pos.x * GRID_SIZE_PX,
        y: token.pos.y * GRID_SIZE_PX,
      };

      switch (token.type) {
        case EntityType.Floor:
          return (
            <Fade lengthMs={50} key={token.id}>
              <Floor key={token.id} contents={token.contents} pos={pixelPos} />
            </Fade>
          );
        case EntityType.Character:
          return (
            // Need to have some sort of transition otherwise the element will
            // never be removed from the dom :(
            <NoopTransition key={token.id}>
              <div
                style={{
                  position: "absolute",
                  top: pixelPos.y,
                  left: pixelPos.x,
                }}
              >
                <Draggable
                  id={token.id}
                  descriptor={{
                    type: "character",
                    contents: token.contents,
                    source: "board",
                  }}
                >
                  <Character
                    contents={token.contents}
                    color={token.color}
                    pos={{
                      x: pixelPos.x,
                      y: pixelPos.y,
                      z: token.pos.z,
                    }}
                  />
                </Draggable>
              </div>
            </NoopTransition>
          );
        case EntityType.Ping:
          return (
            <Fade key={token.id} lengthMs={1000}>
              <Ping x={pixelPos.x} y={pixelPos.y} />
            </Fade>
          );
        /* istanbul ignore next */
        default:
          throw new UnreachableCaseError(token);
      }
    });

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

    return (
      <div
        ref={mergeRefs(container, doubleTapRef, longTapRef, droppableRef)}
        className={classes.container}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={preventDefault}
        aria-label={"Board"}
        style={{
          touchAction,
          border: borderHack,
        }}
      >
        <div className={classes.board}>
          <TransitionGroup>{tokenIcons}</TransitionGroup>
        </div>
      </div>
    );
  }
);

PureBoard.displayName = "PureBoard";

// This exists because rendering the entire board is expensive, and useDroppable causes unnecessary re-renders multiple
// times per pickup and drop
const Board: React.FC = () => {
  const { active, setNodeRef } = useDroppable({
    id: DROPPABLE_IDS.BOARD,
  });

  return <PureBoard isDragging={active !== null} droppableRef={setNodeRef} />;
};

type DivRef = (element: HTMLDivElement | null) => void;

export default Board;
