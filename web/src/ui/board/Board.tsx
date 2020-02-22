import React, {
  MouseEventHandler,
  PointerEventHandler,
  useCallback,
  useRef
} from "react";
import { makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX } from "../../config";
import { Icon, ICONS_BY_ID, WALL_ICON } from "../icons";
import FloorToken from "../token/FloorToken";
import Character from "../token/Character";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import PingToken from "../token/PingToken";
import Draggable from "../../drag/Draggable";
import Droppable from "../../drag/Droppable";
import Pos2d, { posAreEqual, snapToGrid } from "../../util/shape-math";
import { assert } from "../../util/invariants";
import { LocationCollector, TargetLocation } from "../../drag/DroppableMonitor";
import { DraggableType, LocationType } from "../../drag/DragStateTypes";
import { DROPPABLE_IDS } from "../DroppableIds";
import { Token, TokenType } from "../../network/BoardStateApiClient";

let BACKGROUND_COLOR = "#F5F5DC";
let GRID_COLOR = "#947C65";

const useStyles = makeStyles({
  container: {
    width: "100%",
    height: "100%"
  },
  board: {
    backgroundColor: BACKGROUND_COLOR,
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
    backgroundSize: `${GRID_SIZE_PX}px ${GRID_SIZE_PX}px`,
    height: "100%",
    width: "100%",
    zIndex: 0
  }
});

const scrolledPos = (pixelPos: Pos2d) => {
  return {
    x: pixelPos.x + document.documentElement.scrollLeft,
    y: pixelPos.y + document.documentElement.scrollTop
  };
};

const toGridPos = (pixelPos: Pos2d) => {
  const snappedPixelPos = snapToGrid(scrolledPos(pixelPos));
  return {
    x: snappedPixelPos.x / GRID_SIZE_PX,
    y: snappedPixelPos.y / GRID_SIZE_PX
  };
};

const LEFT_MOUSE = 1;
const RIGHT_MOUSE = 2;

const preventDefault: MouseEventHandler = e => e.preventDefault();

interface Props {
  isDragging: boolean;
  tokens: Token[];
  activeFloor: Icon;
  onPingCreated: (pos: Pos2d) => void;
  onFloorCreated: (iconId: string, pos: Pos2d) => void;
  onTokenDeleted: (id: string) => void;
}

const Board: React.FC<Props> = ({
  isDragging,
  tokens,
  activeFloor,
  onPingCreated,
  onFloorCreated,
  onTokenDeleted
}) => {
  const classes = useStyles();
  const container = useRef<HTMLDivElement>(null);

  const getLocation: LocationCollector = useCallback(
    (draggable, pos): TargetLocation | undefined => {
      assert(container.current, "Board ref not assigned properly");
      const gridPos = toGridPos(pos);

      const existingTokenId = tokens.find(
        token =>
          posAreEqual(token.pos, gridPos) && token.type === TokenType.CHARACTER
      )?.id;
      const draggedTokenId =
        draggable.type === DraggableType.TOKEN ? draggable.tokenId : undefined;
      if (existingTokenId && existingTokenId !== draggedTokenId) {
        return;
      }

      const containerRect = container.current.getBoundingClientRect();
      const snappedPixelPos = snapToGrid(scrolledPos(pos));
      return {
        logicalLocation: {
          type: LocationType.GRID,
          ...gridPos
        },
        bounds: {
          top: snappedPixelPos.y + containerRect.y,
          left: snappedPixelPos.x + containerRect.x,
          bottom: snappedPixelPos.y + containerRect.y + GRID_SIZE_PX,
          right: snappedPixelPos.x + containerRect.x + GRID_SIZE_PX
        }
      };
    },
    [tokens]
  );

  const tokenIcons = tokens.map(token => {
    const pixelPos = {
      x: token.pos.x * GRID_SIZE_PX,
      y: token.pos.y * GRID_SIZE_PX
    };

    switch (token.type) {
      case TokenType.FLOOR:
        const floorIcon = ICONS_BY_ID.get(token.iconId, WALL_ICON);
        return <FloorToken key={token.id} icon={floorIcon} pos={pixelPos} />;
      case TokenType.CHARACTER:
        const characterIcon = ICONS_BY_ID.get(token.iconId, WALL_ICON);
        return (
          <Draggable
            key={token.id}
            droppableId={DROPPABLE_IDS.BOARD}
            descriptor={{
              id: `${DROPPABLE_IDS.BOARD}-${token.id}`,
              type: DraggableType.TOKEN,
              icon: characterIcon,
              tokenId: token.id
            }}
          >
            {(isDragging, attributes) => (
              <Character
                {...attributes}
                icon={characterIcon}
                isDragging={isDragging}
                style={{
                  ...attributes.style,
                  position: "absolute",
                  left: pixelPos.x,
                  top: pixelPos.y,
                  zIndex: isDragging ? 10_000 : token.pos.z
                }}
              />
            )}
          </Draggable>
        );
      case TokenType.PING:
        return <PingToken key={token.id} x={pixelPos.x} y={pixelPos.y} />;
      default:
        throw new UnreachableCaseError(token);
    }
  });

  const onPointerDown: PointerEventHandler = ({
    clientX: x,
    clientY: y,
    shiftKey,
    buttons
  }) => {
    const gridPos = toGridPos({ x, y });
    if (shiftKey && buttons === LEFT_MOUSE) {
      onPingCreated(gridPos);
    } else if (
      buttons === LEFT_MOUSE &&
      !tokens.find(token => posAreEqual(token.pos, gridPos))
    ) {
      onFloorCreated(activeFloor.id, gridPos);
    } else if (buttons === RIGHT_MOUSE) {
      const id = tokens.find(token => posAreEqual(token.pos, gridPos))?.id;
      if (id) {
        onTokenDeleted(id);
      }
    }
  };

  const onPointerMove: PointerEventHandler = e => {
    if (isDragging) {
      return;
    }

    // Pointer events are only triggered once per frame, but if the mouse is
    // moving quickly it can actually move over an entire grid square in less
    // than a frame's time, so we'll miss drawing walls in certain places. In
    // browsers that support it, we can request all of the mouse move events
    // since the last frame, and then batch process those
    let events;
    // @ts-ignore
    if (e.nativeEvent.getCoalescedEvents) {
      // @ts-ignore
      events = e.nativeEvent.getCoalescedEvents();
    } else {
      events = [e];
    }

    const processedPositions: Pos2d[] = [];
    for (const event of events) {
      const { clientX: x, clientY: y, buttons, shiftKey } = event;
      const gridPos = toGridPos({ x, y });
      // Skip mouse events that result in the same grid position
      if (processedPositions.some(pos => posAreEqual(pos, gridPos))) {
        continue;
      }

      if (buttons === LEFT_MOUSE && shiftKey) {
        if (
          !tokens.find(
            token =>
              token.type === TokenType.PING && posAreEqual(token.pos, gridPos)
          )
        ) {
          onPingCreated(gridPos);
        }
      } else if (
        buttons === LEFT_MOUSE &&
        !tokens.find(
          token =>
            token.type !== TokenType.PING && posAreEqual(token.pos, gridPos)
        )
      ) {
        onFloorCreated(activeFloor.id, gridPos);
      } else if (buttons === RIGHT_MOUSE) {
        const toDelete = tokens.find(
          token =>
            token.type !== TokenType.PING && posAreEqual(token.pos, gridPos)
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
    >
      <Droppable id={DROPPABLE_IDS.BOARD} getLocation={getLocation}>
        {attributes => (
          <div {...attributes} className={classes.board}>
            {tokenIcons}
          </div>
        )}
      </Droppable>
    </div>
  );
};

export default Board;
