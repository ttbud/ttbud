import { makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX } from "../../config";
import { TransitionGroup } from "react-transition-group";
import mergeRefs from "../../util/mergeRefs";
import { DROPPABLE_IDS } from "../DroppableIds";
import noop from "../../util/noop";
import useDoubleTap, { DoubleTapState } from "../util/useDoubleTap";
import { MouseEventHandler, useCallback, useState } from "react";
import Pos2d from "../../util/shape-math";
import {
  BoardState,
  bottomCharacterAt,
  toPosStr,
  topTokenAt,
} from "./board-state";
import { CHARACTER_HEIGHT, FLOOR_HEIGHT } from "./board-slice";
import { Character, EntityType, TokenContents } from "../../types";
import useLongTap from "../util/useLongTap";
import { useDroppable } from "@dnd-kit/core";
import { LocationType } from "../../drag/DragStateTypes";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import Floor from "../token/Floor";
import Ping from "../token/Ping";
import NoopTransition from "../transition/NoopTransition";
import Fade from "../transition/Fade";
import Draggable2 from "../../drag/Draggable2";
import Character2 from "../token/Character2/Character2";
import { toGridPos } from "./grid";

let GRID_COLOR = "#947C65";

const useStyles = makeStyles((theme) => ({
  container: {
    width: "100%",
    height: "100%",
  },
  board: {
    // Otherwise safari will try to "select" the empty text next to each floor icon
    userSelect: "none",
    backgroundColor: "#F5F5DC",
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

const preventDefault: MouseEventHandler = (e) => e.preventDefault();

type Mode = "draw" | "delete";

interface Props {
  isDragging: boolean;
  boardState: BoardState;
  activeFloor: TokenContents;
  tempCharacter?: Character;
  onFloorCreated: (activeFloor: TokenContents, gridPos: Pos2d) => void;
  onTokenDeleted: (tokenId: string) => void;
  onPingCreated: (pos: Pos2d) => void;
}

const Board2: React.FC<Props> = ({
  isDragging,
  boardState,
  activeFloor,
  tempCharacter,
  onTokenDeleted,
  onFloorCreated,
  onPingCreated,
}) => {
  const classes = useStyles();
  const [mode, setMode] = useState<Mode>("draw");

  const { setNodeRef: setDroppableRef } = useDroppable({ id: "board" });
  const droppableRef = setDroppableRef as (el: HTMLDivElement) => void;

  const onDoubleTap = useCallback(
    (e: PointerEvent) => {
      if (isDragging) return;

      const gridPos = toGridPos({ x: e.clientX, y: e.clientY });
      const tokenId = topTokenAt(boardState, gridPos)?.id;
      if (tokenId) {
        onTokenDeleted(tokenId);
        setMode("delete");
      } else {
        onFloorCreated(activeFloor, gridPos);
      }
    },
    [isDragging, activeFloor, boardState, onFloorCreated, onTokenDeleted]
  );
  const [doubleTapRef, doubleTapState] =
    useDoubleTap<HTMLDivElement>(onDoubleTap);

  const onLongTap = useCallback(
    (e: PointerEvent) => {
      if (isDragging || doubleTapState === DoubleTapState.Active) return;

      const gridPos = toGridPos({ x: e.clientX, y: e.clientY });
      onPingCreated(gridPos);
    },
    [isDragging, onPingCreated, doubleTapState]
  );
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
        const dragId =
          tempCharacter?.id === token.id ? tempCharacter.dragId : token.dragId;

        const tokensAtPos =
          boardState.tokenIdsByPosStr[toPosStr(token.pos)] ?? [];

        const isInStack = tokensAtPos.length > 1;
        const isBottomOfStack =
          bottomCharacterAt(boardState, token.pos)?.id === token.id;
        return (
          // Need to have some sort of transition otherwise the element will
          // never be removed from the dom :(
          <NoopTransition key={token.id}>
            <Draggable2
              id={dragId}
              style={{
                position: "absolute",
                left: pixelPos.x,
                top: pixelPos.y,
                zIndex: token.pos.z,
              }}
              descriptor={{
                contents: token.contents,
                origin: {
                  containerId: DROPPABLE_IDS.BOARD,
                  location: {
                    type: LocationType.Grid,
                    x: token.pos.x,
                    y: token.pos.y,
                  },
                },
                networkId: token.id,
              }}
            >
              <Character2
                isInStack={isInStack}
                isBottomOfStack={!!isBottomOfStack}
                contents={token.contents}
              />
            </Draggable2>
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
      ref={mergeRefs(doubleTapRef, longTapRef, droppableRef)}
      className={classes.container}
      onPointerDown={noop}
      onPointerMove={noop}
      onPointerUp={noop}
      onContextMenu={preventDefault}
      aria-label={"Board"}
      style={{
        touchAction,
        border: borderHack,
      }}
    >
      <div className={classes.board}>
        <TransitionGroup>
          {tokenIcons}
          {/*TODO: Make this work/pick a better api */}
          {tempCharacter && !boardState.entityById[tempCharacter.id] && (
            // Need to have some sort of transition otherwise the element will
            // never be removed from the dom :(
            <NoopTransition key={tempCharacter.id}>
              <Draggable2
                id={tempCharacter.dragId}
                style={{
                  position: "absolute",
                  left: tempCharacter.pos.x * GRID_SIZE_PX,
                  top: tempCharacter.pos.y * GRID_SIZE_PX,
                  zIndex: CHARACTER_HEIGHT,
                }}
                descriptor={{
                  contents: tempCharacter.contents,
                  origin: {
                    containerId: DROPPABLE_IDS.BOARD,
                    location: {
                      type: LocationType.Grid,
                      x: tempCharacter.pos.x,
                      y: tempCharacter.pos.y,
                    },
                  },
                }}
              >
                <Character2 contents={tempCharacter.contents} />
              </Draggable2>
            </NoopTransition>
          )}
        </TransitionGroup>
      </div>
    </div>
  );
};

export default Board2;
