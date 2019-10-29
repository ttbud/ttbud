import React, { MouseEvent, useEffect, useState } from "react";
import Token from "./Token";
import beard from "../icon/beard.svg";
import bowman from "../icon/bowman.svg";
import kangaroo from "../icon/kangaroo.svg";
import suspicious from "../icon/suspicious.svg";
import swordman from "../icon/swordman.svg";
import stoneWall from "../icon/stone-wall.svg";
import wolfHead from "../icon/wolf-head.svg";
import elfHelmet from "../icon/elf-helmet.svg";
import entMouth from "../icon/ent-mouth.svg";
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
  { id: "a511ebd2-827b-490d-b20a-c206e4edd25e", icon: beard, type: "beard" },
  { id: "cde2b122-0023-472c-a083-9c8bcb5830aa", icon: bowman, type: "bowman"},
  { id: "0a2bd4c8-bf65-48bc-ac4a-2d0585c8226e", icon: elfHelmet, type: "elfHelmet"},
  { id: "c8345331-d3d9-436b-abf9-054deac8fcc1", icon: entMouth, type: "entMouth"},
  { id: "7d8445b4-5d80-43a7-aba5-863aa1617ca1", icon: kangaroo, type: "kangaroo"},
  { id: "46dd9a28-f5d9-4256-a679-d08295ed2995", icon: suspicious, type: "suspicious"},
  { id: "47341013-dd7f-44e2-8ee1-53ca59e2df60", icon: swordman, type: "swordman"},
  { id: "94db5586-2d18-4250-a874-58264fcb4b79", icon: wolfHead, type: "wolfHead"},
];

type MouseType = "drawing_walls" | "deleting" | "none";

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

  const onTokenPlaced = (type: TokenType, x: number, y: number) => {
    let token = {
      id: uuid(),
      x: dragSnapToGrid(x),
      y: dragSnapToGrid(y),
      type: type.type,
      icon: type.icon
    };
    if (client) {
      client.queueCreate(token);
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
      type: "stoneWall",
      icon: stoneWall
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
        break
      }
    }
  };

  const getTokenAt = (x: number, y: number): TokenState|null => {
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
        onContextMenu={e => e.preventDefault() }
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
