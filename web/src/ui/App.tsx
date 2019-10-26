import React, { MouseEvent, useEffect, useState } from "react";
import Token from "./Token";
import dwarf from "../icon/dwarf.svg";
import bear from "../icon/bear.svg";
import wall from "../icon/wall.svg";
import { List } from "immutable";
import { makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX } from "../config";
import TokenSheet, { TokenType } from "./TokenSheet";
import { TokenState, TokenStateClient } from "../network/TokenStateClient";
import uuid from "uuid";

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

const TOKEN_TYPES = [
  { id: "a511ebd2-827b-490d-b20a-c206e4edd25e", icon: bear, type: 'bear'},
  { id: "643c7cf8-befb-4a72-b707-9c0399d2a365", icon: dwarf, type: 'dwarf' }
];

const App = () => {
  const classes = useStyles();

  const [tokens, setTokens] = useState(List.of<TokenState>());
  const [client, setClient] = useState<TokenStateClient>();

  const getNewRoomUrl = async () => {
    let resp;
    let wsUrl;
    try {
      resp = await fetch("http://192.168.0.102:5000/api/socket");
      const json = await resp.json();
      wsUrl = json.path;
    } catch (e) {
      return null;
    }
    const httpUrl = `http://${window.location.host}/${btoa(wsUrl)}`;
    window.history.replaceState({}, "Your special room", httpUrl);
    return wsUrl;
  };

  useEffect(() => {
    const connect = async () => {
      const path = window.location.pathname.split("/")[1];
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

  const onTokenPlaced = (type: TokenType, x: number, y: number) => {
    let token = {
      id: uuid(),
      x: dragSnapToGrid(x),
      y: dragSnapToGrid(y),
      type: type.type,
      icon: type.icon
    };
    if (client) {
      client.sendCreate(token);
    }
    setTokens(tokens.push(token));
  };

  const tokenIcons = tokens.map((token, i) => (
    <Token
      pos={{ x: token.x, y: token.y }}
      icon={token.icon}
      key={token.id}
      onDropped={(x, y) => {
        const newToken = {
          id: token.id,
          x: dragSnapToGrid(x),
          y: dragSnapToGrid(y),
          type: token.type,
          icon: token.icon
        };
        if (client) {
          client.sendUpdate(newToken);
        }
        setTokens(tokens.set(i, newToken));
      }}
    />
  ));

  const onMapClick = (e: MouseEvent) => {
    const token = {
      id: uuid(),
      x: clickSnapToGrid(e.clientX),
      y: clickSnapToGrid(e.clientY),
      type: 'wall',
      icon: wall
    };
    if (client) {
      client.sendCreate(token);
    }
    setTokens(tokens.push(token));
  };

  const onMapRightClick = (e: MouseEvent) => {
    e.preventDefault();
    const x = clickSnapToGrid(e.clientX);
    const y = clickSnapToGrid(e.clientY);
    for (const [i, token] of tokens.entries()) {
      if (token.x === x && token.y === y) {
        if (client) {
          client.sendDelete(token.id);
        }

        setTokens(tokens.delete(i));
      }
    }
  };

  return (
    <div>
      <div
        className={classes.map}
        onClick={onMapClick}
        onContextMenuCapture={onMapRightClick}
      >
        {tokenIcons}
      </div>
      <div className={classes.sheets}>
        <TokenSheet tokenTypes={TOKEN_TYPES} onTokenPlaced={onTokenPlaced} />
      </div>
    </div>
  );
};

export default App;
