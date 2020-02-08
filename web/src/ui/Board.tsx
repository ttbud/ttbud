import React, { MouseEvent, useState } from "react";
import { makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX } from "../config";
import { Icon, ICONS_BY_ID, IconType, WALL_ICON } from "./icons";
import uuid from "uuid";
import { Ping, TokenState } from "../network/TokenStateClient";
import { List } from "immutable";
import FloorToken from "./token/FloorToken";
import CardToken from "./token/CardToken";
import PingToken from "./token/PingToken";
import UnreachableCaseError from "../util/UnreachableCaseError";

let BACKGROUND_COLOR = "#F5F5DC";
let GRID_COLOR = "#947C65";

const useStyles = makeStyles({
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
    height: "2000px",
    width: "4000px",
    zIndex: 0,
    position: "absolute",
    // All the tokens inside the map have to be position absolute so that the
    // drag offset calculations work properly
    "& div": {
      position: "absolute"
    }
  }
});

enum MouseType {
  drawing_walls = "walls",
  deleting = "deleting",
  none = "none"
}

const snapToGrid = (x: number, y: number) => ({
  x: Math.floor(getX(x) / GRID_SIZE_PX) * GRID_SIZE_PX,
  y: Math.floor(getY(y) / GRID_SIZE_PX) * GRID_SIZE_PX
});
const getX = (x: number) =>
    x + document.documentElement.scrollLeft;
const getY = (x: number) =>
    x + document.documentElement.scrollTop;

interface Props {
  tokens: List<TokenState>;
  pings: List<Ping>;
  activeFloor: Icon;
  onPingCreated: (x: number, y: number) => void;
  onTokenCreated: (token: TokenState) => void;
  onTokenDeleted: (tokenId: string) => void;
  onTokenMoved: (token: TokenState) => void;
}

const Board = (props: Props) => {
  const classes = useStyles();
  const [mouseType, setMouseType] = useState<MouseType>(MouseType.none);

  const onMouseMove = (e: MouseEvent) => {
    // If you hold down a mouse button while moving the cursor off the board
    // the board will never get the mouse up event. So check here if the
    // button really is still held down
    if (e.buttons === 0) {
      setMouseType(MouseType.none);
      return;
    }

    if (mouseType === MouseType.drawing_walls) {
      placeFloorAt(props.activeFloor, e.clientX, e.clientY);
    } else if (mouseType === MouseType.deleting) {
      deleteAt(e.clientX, e.clientY);
    }
  };

  const onMouseDown = (e: MouseEvent) => {
    if (e.button === 0 && e.shiftKey) {
      const {x, y} = snapToGrid(e.clientX, e.clientY);
      props.onPingCreated(x, y);
    } else if (e.button === 0) {
      setMouseType(MouseType.drawing_walls);
      placeFloorAt(props.activeFloor, e.clientX, e.clientY);
    } else if (e.button === 2) {
      setMouseType(MouseType.deleting);
      deleteAt(e.clientX, e.clientY);
    }
  };

  const deleteAt = (x: number, y: number) => {
    const token = getTokenAt(x, y);
    if (token) {
      props.onTokenDeleted(token.id);
    }
  };

  const getTokenAt = (x: number, y: number) => {
    const pos = snapToGrid(x, y);

    return props.tokens
      .filter(token => token.x === pos.x && token.y === pos.y)
      .maxBy(token => token.z);
  };

  const placeFloorAt = (icon: Icon, x: number, y: number) => {
    if (getTokenAt(x, y)) {
      return;
    }

    const pos = snapToGrid(x, y);
    props.onTokenCreated({
      id: uuid(),
      x: pos.x,
      y: pos.y,
      z: icon.type === IconType.floor ? 0 : 1,
      iconId: icon.id
    });
  };

  const onMouseUp = () => setMouseType(MouseType.none);

  const tokenIcons = props.tokens.map(token => {
    const icon = ICONS_BY_ID.get(token.iconId, WALL_ICON);
    const pos = { x: token.x, y: token.y, z: token.z };

    const onDropped = (x: number, y: number) => {
      const pos = snapToGrid(x, y);
      const newToken = {
        id: token.id,
        x: pos.x,
        y: pos.y,
        z: token.z,
        iconId: token.iconId
      };
      props.onTokenMoved(newToken);
    };

    switch (icon.type) {
      case IconType.floor:
      case IconType.wall:
        return <FloorToken key={token.id} icon={icon} pos={pos} />;
      case IconType.token:
        return (
          <CardToken
            key={token.id}
            icon={icon}
            pos={pos}
            onDropped={onDropped}
          />
        );
      default:
        throw new UnreachableCaseError(icon.type);
    }
  });

  const pingIcons = props.pings.map(ping => (
    <PingToken key={ping.id} x={ping.x} y={ping.y} />
  ));

  return (
    <div
      className={classes.board}
      onMouseUp={onMouseUp}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onContextMenu={e => e.preventDefault()}
    >
      {tokenIcons}
      {pingIcons}
    </div>
  );
};

export default Board;
