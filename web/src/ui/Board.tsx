import React, { MouseEvent, useState } from "react";
import { makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX } from "../config";
import { Icon, ICONS_BY_ID, IconType, WALL_ICON } from "./icons";
import uuid from "uuid";
import { TokenState } from "../network/TokenStateClient";
import { List } from "immutable";
import FloorToken from "./token/FloorToken";
import CardToken from "./token/CardToken";
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
    height: "100%",
    width: "100%",
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

const dragSnapToGrid = (x: number) =>
  Math.round(x / GRID_SIZE_PX) * GRID_SIZE_PX;
const clickSnapToGrid = (x: number) =>
  Math.floor(x / GRID_SIZE_PX) * GRID_SIZE_PX;

interface Props {
  tokens: List<TokenState>;
  activeFloor: Icon;
  onTokenCreated: (token: TokenState) => void;
  onTokenDeleted: (tokenId: string) => void;
  onTokenMoved: (token: TokenState) => void;
}

const Board = (props: Props) => {
  const classes = useStyles();
  const [mouseType, setMouseType] = useState<MouseType>(MouseType.none);

  const onMouseMove = (e: MouseEvent) => {
    if (mouseType === MouseType.drawing_walls) {
      placeFloorAt(props.activeFloor, e.clientX, e.clientY);
    } else if (mouseType === MouseType.deleting) {
      deleteAt(e.clientX, e.clientY);
    }
  };

  const onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
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
    const gridX = clickSnapToGrid(x);
    const gridY = clickSnapToGrid(y);

    return props.tokens
      .filter(token => token.x === gridX && token.y === gridY)
      .maxBy(token => token.z);
  };

  const placeFloorAt = (icon: Icon, x: number, y: number) => {
    if (getTokenAt(x, y)) {
      return;
    }

    props.onTokenCreated({
      id: uuid(),
      x: clickSnapToGrid(x),
      y: clickSnapToGrid(y),
      z: 0,
      iconId: icon.id
    });
  };

  const onMouseUp = () => setMouseType(MouseType.none);

  const tokenIcons = props.tokens.map(token => {
    const icon = ICONS_BY_ID.get(token.iconId, WALL_ICON);
    const pos = { x: token.x, y: token.y, z: token.z };

    const onDropped = (x: number, y: number) => {
      const newToken = {
        id: token.id,
        x: dragSnapToGrid(x),
        y: dragSnapToGrid(y),
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

  return (
    <div
      className={classes.board}
      onMouseUp={onMouseUp}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onContextMenu={e => e.preventDefault()}
    >
      {tokenIcons}
    </div>
  );
};

export default Board;
