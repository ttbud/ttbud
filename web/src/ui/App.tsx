import React, { MouseEvent, useEffect, useState } from "react";
import CardToken from "./token/CardToken";
import { List } from "immutable";
import { makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX } from "../config";
import CardTokenSheet from "./CardTokenSheet";
import { TokenState, TokenStateClient } from "../network/TokenStateClient";
import uuid from "uuid";
import { Icon, ICONS, ICONS_BY_ID, IconType, WALL_ICON } from "./icons";
import FloorToken from "./token/FloorToken";
import UnreachableCaseError from "../util/UnreachableCaseError";
import FloorTokenSheet from "./FloorTokenSheet";

let BACKGROUND_COLOR = "#F5F5DC";
let GRID_COLOR = "#947C65";

const dragSnapToGrid = (x: number) =>
  Math.round(x / GRID_SIZE_PX) * GRID_SIZE_PX;
const clickSnapToGrid = (x: number) =>
  Math.floor(x / GRID_SIZE_PX) * GRID_SIZE_PX;

const useStyles = makeStyles(theme => ({
  map: {
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
  },
  tokenSheet: {
    display: "flex",
    flexDirection: "column",
    maxWidth: GRID_SIZE_PX * 2,
    position: "absolute",
    bottom: theme.spacing(1),
    left: theme.spacing(1)
  },
  floorSheet: {
    display: "flex",
    flexDirection: "row",
    maxWidth: GRID_SIZE_PX * 2,
    position: "absolute",
    bottom: theme.spacing(1),
    left: 0,
    right: 0,
    margin: "auto"
  }
}));

enum MouseType {
  drawing_walls,
  deleting,
  none
}

const TOKEN_SHEET_ICONS = ICONS.filter(icon => icon.type === IconType.token);
const FLOOR_SHEET_ICONS = ICONS.filter(
  icon => icon.type === IconType.floor || icon.type === IconType.wall
);

const App = () => {
  const classes = useStyles();

  const [mouseType, setMouseType] = useState<MouseType>(MouseType.none);
  const [activeFloor, setActiveFloor] = useState(WALL_ICON);
  const [tokens, setTokens] = useState(List.of<TokenState>());
  const [client, setClient] = useState<TokenStateClient>();

  const getNewRoomUrl = async () => {
    let resp;
    let wsUrl;
    try {
      resp = await fetch("/api/socket");
      const json = await resp.json();
      wsUrl = json.path;
    } catch (e) {
      return null;
    }
    const httpUrl = `/room/${btoa(wsUrl)}`;
    window.history.replaceState({}, "Your special room", httpUrl);
    return wsUrl;
  };

  useEffect(() => {
    const connect = async () => {
      const path = window.location.pathname.split("/room/")[1];
      const roomUrl = path ? atob(path) : await getNewRoomUrl();
      if (!roomUrl) {
        return;
      }
      let socket = new WebSocket(roomUrl);
      const client = new TokenStateClient(socket, state => {
        setTokens(List.of(...state));
      });
      setClient(client);
    };

    // noinspection JSIgnoredPromiseFromCall
    connect();
  }, []);

  const onTokenPlaced = (icon: Icon, x: number, y: number) => {
    let token = {
      id: uuid(),
      x: dragSnapToGrid(x),
      y: dragSnapToGrid(y),
      z: icon.type === IconType.floor ? 0 : 1,
      iconId: icon.id
    };
    if (client) {
      client.queueCreate(token);
    }
    setTokens(tokens.push(token));
  };

  const tokenIcons = tokens.map((token, i) => {
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
      if (client) {
        client.queueUpdate(newToken);
      }
      setTokens(tokens.set(i, newToken));
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

  const onMapMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      setMouseType(MouseType.drawing_walls);
      placeFloorAt(activeFloor, e.clientX, e.clientY);
    } else if (e.button === 2) {
      setMouseType(MouseType.deleting);
      deleteAt(e.clientX, e.clientY);
    }
  };

  const onMapMouseUp = () => setMouseType(MouseType.none);

  const placeFloorAt = (icon: Icon, x: number, y: number) => {
    const gridX = clickSnapToGrid(x);
    const gridY = clickSnapToGrid(y);

    if (getTokenAt(gridX, gridY)) {
      return;
    }

    const token = {
      id: uuid(),
      x: clickSnapToGrid(x),
      y: clickSnapToGrid(y),
      z: 0,
      iconId: icon.id
    };
    if (client) {
      client.queueCreate(token);
    }
    setTokens(tokens.push(token));
  };

  const deleteAt = (x: number, y: number) => {
    const gridX = clickSnapToGrid(x);
    const gridY = clickSnapToGrid(y);
    const token = tokens
      .filter(token => token.x === gridX && token.y === gridY)
      .maxBy(token => token.z);

    if (client && token) {
      client.queueDelete(token.id);
    }
    if (token) {
      setTokens(tokens.delete(tokens.indexOf(token)));
    }
  };

  const getTokenAt = (x: number, y: number): TokenState | null => {
    const gridX = clickSnapToGrid(x);
    const gridY = clickSnapToGrid(y);
    for (const token of tokens) {
      if (token.x === gridX && token.y === gridY) {
        return token;
      }
    }

    return null;
  };

  const onMapMouseMoving = (e: MouseEvent) => {
    if (mouseType === MouseType.drawing_walls) {
      placeFloorAt(activeFloor, e.clientX, e.clientY);
    } else if (mouseType === MouseType.deleting) {
      deleteAt(e.clientX, e.clientY);
    }
  };

  return (
    <div>
      <div
        className={classes.map}
        onMouseUp={onMapMouseUp}
        onMouseDown={onMapMouseDown}
        onMouseMove={onMapMouseMoving}
        onContextMenu={e => e.preventDefault()}
      >
        {tokenIcons}
      </div>
      <div className={classes.tokenSheet}>
        <CardTokenSheet
          tokenTypes={TOKEN_SHEET_ICONS}
          onTokenPlaced={onTokenPlaced}
        />
      </div>
      <div className={classes.floorSheet}>
        <FloorTokenSheet
          activeFloor={activeFloor}
          icons={FLOOR_SHEET_ICONS}
          onFloorSelected={setActiveFloor}
        />
      </div>
    </div>
  );
};

export default App;
