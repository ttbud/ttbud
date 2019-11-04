import React, { MouseEvent, useEffect, useState } from "react";
import Token from "./Token";
import { List } from "immutable";
import { makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX } from "../config";
import TokenSheet from "./TokenSheet";
import { TokenState, TokenStateClient } from "../network/TokenStateClient";
import uuid from "uuid";
import {Icon, ICONS, ICONS_BY_ID, IconType, WALL_ICON} from "./icons";

let BACKGROUND_COLOR = "#F5F5DC";
let GRID_COLOR = "#947C65";

const dragSnapToGrid = (x: number) =>
  Math.round(x / GRID_SIZE_PX) * GRID_SIZE_PX;
const clickSnapToGrid = (x: number) =>
  Math.floor(x / GRID_SIZE_PX) * GRID_SIZE_PX;

const useStyles = makeStyles({
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
    position: "absolute",
    // All the tokens inside the map have to be position absolute so that the
    // drag offset calculations work properly
    "& div": {
      position: "absolute"
    }
  },
  sheets: {
    display: "flex",
    flexDirection: "column",
    maxWidth: GRID_SIZE_PX * 2,
    position: "absolute",
    bottom: 0
  }
});

type MouseType = "drawing_walls" | "deleting" | "none";
const TOKEN_SHEET_ICONS = ICONS.filter(icon => icon.type === IconType.token);

const App = () => {
  const classes = useStyles();

  const [mouseType, setMouseType] = useState<MouseType>("none");
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
      z: 0,
      iconId: icon.id
    };
    if (client) {
      client.queueCreate(token);
    }
    setTokens(tokens.push(token));
  };

  const tokenIcons = tokens.map((token, i) => (
    <Token
      pos={{ x: token.x, y: token.y, z: token.z }}
      icon={ICONS_BY_ID.get(token.iconId, WALL_ICON)}
      key={token.id}
      onDropped={(x, y) => {
        const newToken = {
          id: token.id,
          x: dragSnapToGrid(x),
          y: dragSnapToGrid(y),
          z: 0,
          iconId: token.iconId
        };
        if (client) {
          client.queueUpdate(newToken);
        }
        setTokens(tokens.set(i, newToken));
      }}
    />
  ));

  const onMapMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      setMouseType("drawing_walls");
      placeWallAt(e.clientX, e.clientY);
    } else if (e.button === 2) {
      setMouseType("deleting");
      deleteAt(e.clientX, e.clientY);
    }
  };

  const onMapMouseUp = () => setMouseType("none");

  const placeWallAt = (x: number, y: number) => {
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
      iconId: WALL_ICON.id
    };
    if (client) {
      client.queueCreate(token);
    }
    setTokens(tokens.push(token));
  };

  const deleteAt = (x: number, y: number) => {
    const gridX = clickSnapToGrid(x);
    const gridY = clickSnapToGrid(y);
    for (const [i, token] of tokens.entries()) {
      if (token.x === gridX && token.y === gridY) {
        if (client) {
          client.queueDelete(token.id);
        }

        setTokens(tokens.delete(i));
        break;
      }
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
    if (mouseType === "drawing_walls") {
      placeWallAt(e.clientX, e.clientY);
    } else if (mouseType === "deleting") {
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
      <div className={classes.sheets}>
        <TokenSheet
          tokenTypes={TOKEN_SHEET_ICONS}
          onTokenPlaced={onTokenPlaced}
        />
      </div>
    </div>
  );
};

export default App;
