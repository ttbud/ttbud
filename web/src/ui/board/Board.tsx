import React, {
  MouseEventHandler,
  PointerEventHandler,
  useCallback,
  useRef,
} from "react";
import { makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX, GRID_SIZE_PX_X, GRID_SIZE_PX_Y } from "../../config";
import Floor from "../token/Floor";
import Character from "../token/Character";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import Ping from "../token/Ping";
import Draggable from "../../drag/Draggable";
import Droppable from "../../drag/Droppable";
import Pos2d, { posAreEqual, snapToGrid } from "../../util/shape-math";
import { assert } from "../../util/invariants";
import { LocationCollector, TargetLocation } from "../../drag/DroppableMonitor";
import {
  DraggableType,
  LocationType,
  DragStateType,
} from "../../drag/DragStateTypes";
import { DROPPABLE_IDS } from "../DroppableIds";
import { TransitionGroup } from "react-transition-group";
import Fade from "../transition/Fade";
import NoopTransition from "../transition/NoopTransition";
import { RootState } from "../../store/rootReducer";
import { addPing, addFloor, removeToken } from "./board-slice";
import { connect } from "react-redux";
import { Entity, EntityType, TokenContents } from "../../types";
import hexagon from "../../hexagon.svg";

const useStyles = makeStyles((theme) => ({
  container: {
    width: "100%",
    height: "100%",
  },
  board: {
    backgroundColor: theme.palette.background.default,
    backgroundImage: `url(${hexagon})`,
    backgroundSize: `${GRID_SIZE_PX_X}px ${GRID_SIZE_PX_Y}px`,
    height: "100%",
    width: "100%",
    zIndex: 0,
  },
}));

const scrolledPos = (pixelPos: Pos2d) => {
  return {
    x: pixelPos.x + document.documentElement.scrollLeft,
    y: pixelPos.y + document.documentElement.scrollTop,
  };
};

const toGridPos = (pixelPos: Pos2d) => {
  const snappedPixelPos = snapToGrid(scrolledPos(pixelPos));
  return {
    x: snappedPixelPos.x / GRID_SIZE_PX_X,
    y: snappedPixelPos.y / GRID_SIZE_PX_Y,
  };
};

const LEFT_MOUSE = 1;
const RIGHT_MOUSE = 2;

const preventDefault: MouseEventHandler = (e) => e.preventDefault();

interface Props {
  isDragging: boolean;
  tokens: Entity[];
  activeFloor: TokenContents;
  onPingCreated: (pos: Pos2d) => void;
  onFloorCreated: (contents: TokenContents, pos: Pos2d) => void;
  onTokenDeleted: (id: string) => void;
}

const mapStateToProps = (state: RootState) => ({
  isDragging: state.drag.type === DragStateType.Dragging,
  tokens: state.board.tokens,
  activeFloor: state.floorTray.activeFloor,
});

const dispatchProps = {
  onPingCreated: addPing,
  onFloorCreated: addFloor,
  onTokenDeleted: removeToken,
};

const PureBoard: React.FC<Props> = ({
  isDragging,
  tokens,
  activeFloor,
  onPingCreated,
  onFloorCreated,
  onTokenDeleted,
}) => {
  const classes = useStyles();
  const container = useRef<HTMLDivElement>(null);

  const getLocation: LocationCollector = useCallback(
    (draggable, pos): TargetLocation | undefined => {
      assert(container.current, "Board ref not assigned properly");
      const gridPos = toGridPos(pos);

      const existingTokenId = tokens.find(
        (token) =>
          posAreEqual(token.pos, gridPos) && token.type === EntityType.Character
      )?.id;
      const draggedTokenId =
        draggable.type === DraggableType.Token ? draggable.tokenId : undefined;
      if (existingTokenId && existingTokenId !== draggedTokenId) {
        return;
      }

      const containerRect = container.current.getBoundingClientRect();
      const snappedPixelPos = snapToGrid(scrolledPos(pos));
      return {
        logicalLocation: {
          type: LocationType.Grid,
          ...gridPos,
        },
        bounds: {
          top: snappedPixelPos.y + containerRect.y,
          left: snappedPixelPos.x + containerRect.x,
          bottom: snappedPixelPos.y + containerRect.y + GRID_SIZE_PX,
          right: snappedPixelPos.x + containerRect.x + GRID_SIZE_PX,
        },
      };
    },
    [tokens]
  );

  const tokenIcons = tokens.map((token) => {
    const pixelPos = {
      x: token.pos.x * GRID_SIZE_PX_X, //+ token.pos.y % 2 * 0.5 * GRID_SIZE_PX_X
      y: token.pos.y * GRID_SIZE_PX_Y,
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
            <Draggable
              droppableId={DROPPABLE_IDS.BOARD}
              descriptor={{
                id: `${DROPPABLE_IDS.BOARD}-${token.id}`,
                type: DraggableType.Token,
                contents: token.contents,
                tokenId: token.id,
              }}
            >
              {(isDragging, attributes) => (
                <Character
                  dragAttributes={attributes}
                  contents={token.contents}
                  isDragging={isDragging}
                  color={token.color}
                  pos={{
                    x: pixelPos.x,
                    y: pixelPos.y,
                    z: token.pos.z,
                  }}
                />
              )}
            </Draggable>
          </NoopTransition>
        );
      case EntityType.Ping:
        return (
          <Fade key={token.id} lengthMs={1000}>
            <Ping x={pixelPos.x} y={pixelPos.y} />
          </Fade>
        );
      default:
        throw new UnreachableCaseError(token);
    }
  });

  const onPointerDown: PointerEventHandler = ({
    clientX: x,
    clientY: y,
    shiftKey,
    buttons,
  }) => {
    const gridPos = toGridPos({ x, y });
    if (shiftKey && buttons === LEFT_MOUSE) {
      onPingCreated(gridPos);
    } else if (
      buttons === LEFT_MOUSE &&
      !tokens.find((token) => posAreEqual(token.pos, gridPos))
    ) {
      onFloorCreated(activeFloor, gridPos);
    } else if (buttons === RIGHT_MOUSE) {
      const id = tokens.find((token) => posAreEqual(token.pos, gridPos))?.id;
      if (id) {
        onTokenDeleted(id);
      }
    }
  };

  const onPointerMove: PointerEventHandler = (e) => {
    if (isDragging) {
      return;
    }

    // Pointer events are only triggered once per frame, but if the mouse is
    // moving quickly it can actually move over an entire grid square in less
    // than a frame's time, so we'll miss drawing walls in certain places. In
    // browsers that support it, we can request all of the mouse move events
    // since the last frame, and then batch process those
    let events: PointerEvent[];
    if (e.nativeEvent.getCoalescedEvents) {
      events = e.nativeEvent.getCoalescedEvents();
    } else {
      events = [e.nativeEvent];
    }

    const processedPositions: Pos2d[] = [];
    for (const event of events) {
      const { clientX: x, clientY: y, buttons, shiftKey } = event;
      const gridPos = toGridPos({ x, y });
      // Skip mouse events that result in the same grid position
      if (processedPositions.some((pos) => posAreEqual(pos, gridPos))) {
        continue;
      }

      if (buttons === LEFT_MOUSE && shiftKey) {
        if (
          !tokens.find(
            (token) =>
              token.type === EntityType.Ping && posAreEqual(token.pos, gridPos)
          )
        ) {
          onPingCreated(gridPos);
        }
      } else if (
        buttons === LEFT_MOUSE &&
        !tokens.find(
          (token) =>
            token.type !== EntityType.Ping && posAreEqual(token.pos, gridPos)
        )
      ) {
        onFloorCreated(activeFloor, gridPos);
      } else if (buttons === RIGHT_MOUSE) {
        const toDelete = tokens.find(
          (token) =>
            token.type !== EntityType.Ping && posAreEqual(token.pos, gridPos)
        );
        if (toDelete) {
          onTokenDeleted(toDelete.id);
        }
      }

      processedPositions.push(gridPos);
    }
  };

  return (
    <div
      ref={container}
      className={classes.container}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onContextMenu={preventDefault}
      aria-label={"Board"}
    >
      <Droppable id={DROPPABLE_IDS.BOARD} getLocation={getLocation}>
        {(attributes) => (
          <div {...attributes} className={classes.board}>
            <TransitionGroup>{tokenIcons}</TransitionGroup>
          </div>
        )}
      </Droppable>
    </div>
  );
};

const Board = connect(mapStateToProps, dispatchProps)(PureBoard);

export { PureBoard };
export default Board;
