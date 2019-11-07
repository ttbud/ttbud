import React, { useEffect, useState } from "react";
import { List } from "immutable";
import { makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX } from "../config";
import CardTokenSheet from "./CardTokenSheet";
import { TokenState, TokenStateClient } from "../network/TokenStateClient";
import uuid from "uuid";
import { Icon, ICONS, IconType, WALL_ICON } from "./icons";
import FloorTokenSheet from "./FloorTokenSheet";
import Board from "./Board";


const dragSnapToGrid = (x: number) =>
  Math.round(x / GRID_SIZE_PX) * GRID_SIZE_PX;

const useStyles = makeStyles(theme => ({
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

const TOKEN_SHEET_ICONS = ICONS.filter(icon => icon.type === IconType.token);
const FLOOR_SHEET_ICONS = ICONS.filter(
  icon => icon.type === IconType.floor || icon.type === IconType.wall
);

const App = () => {
  const classes = useStyles();

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

  const deleteToken = (tokenId: string) => {
    setTokens(tokens.delete(tokens.findIndex(token => token.id === tokenId)));
    if (client) {
      client.queueDelete(tokenId);
    }
  };

  const createToken = (token: TokenState) => {
    setTokens(tokens.push(token));
    if (client) {
      client.queueCreate(token);
    }
  };

  const updateToken = (newToken: TokenState) => {
    setTokens(
      tokens.set(tokens.findIndex(token => token.id === newToken.id), newToken)
    );
    if (client) {
      client.queueUpdate(newToken);
    }
  };

  return (
    <div>
      <Board
        tokens={tokens}
        onTokenCreated={createToken}
        onTokenDeleted={deleteToken}
        onTokenMoved={updateToken}
        activeFloor={activeFloor}
      />
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
