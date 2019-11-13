import React, { useEffect, useState } from "react";
import { List } from "immutable";
import { makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX } from "../config";
import CardTokenSheet from "./CardTokenSheet";
import {
  Ping,
  TokenState,
  TokenStateClient
} from "../network/TokenStateClient";
import uuid from "uuid";
import { Icon, ICONS, IconType, WALL_ICON } from "./icons";
import FloorTokenSheet from "./FloorTokenSheet";
import Board from "./Board";

const dragSnapToGrid = (x: number) =>
  Math.round(x / GRID_SIZE_PX) * GRID_SIZE_PX;

const useStyles = makeStyles(theme => ({
  tokenSheet: {
    maxWidth: GRID_SIZE_PX * 2,
    position: "absolute",
    bottom: theme.spacing(1),
    left: theme.spacing(1)
  },
  floorSheet: {
    display: "inline-flex",
    position: "absolute",
    bottom: theme.spacing(1),
    left: '50%',
    transform: "translateX(-50%)"
  }
}));

const PING_LENGTH_MS = 3000;
const TOKEN_SHEET_ICONS = ICONS.filter(icon => icon.type === IconType.token);
const FLOOR_SHEET_ICONS = ICONS.filter(
  icon => icon.type === IconType.floor || icon.type === IconType.wall
);

interface UiPing extends Ping {
  removalTimestamp: number;
}

const App = () => {
  const classes = useStyles();

  const [activeFloor, setActiveFloor] = useState(WALL_ICON);
  const [tokens, setTokens] = useState(List.of<TokenState>());
  const [pings, setPings] = useState(List.of<UiPing>());
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
      const client = new TokenStateClient(socket);
      setClient(client);
    };

    // noinspection JSIgnoredPromiseFromCall
    connect();
  }, []);

  useEffect(() => {
    if (!client) {
      return;
    }

    const stateListenerId = client.addStateListener(state =>
      setTokens(List.of(...state))
    );
    const pingListenerId = client.addPingListener(newPing => {
      // We made the ping, we're just getting that message back
      if (pings.some(ping => ping.id === newPing.id)) {
        return;
      }

      setPings(
        pings.push({
          id: newPing.id,
          x: newPing.x,
          y: newPing.y,
          removalTimestamp: Date.now() + PING_LENGTH_MS
        })
      );
    });

    return () => {
      client.removeStateListener(stateListenerId);
      client.removePingListener(pingListenerId);
    };
  }, [client, pings]);

  useEffect(() => {
    const soonestPing = pings.minBy(ping => ping.removalTimestamp);
    if (!soonestPing) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPings(pings.delete(pings.indexOf(soonestPing)));
    }, soonestPing.removalTimestamp - Date.now());

    return () => window.clearTimeout(timer);
  }, [pings]);

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

  const createPing = (x: number, y: number) => {
    const ping: UiPing = {
      id: uuid(),
      x: x,
      y: y,
      removalTimestamp: Date.now() + PING_LENGTH_MS
    };

    setPings(pings.push(ping));
    if (client) {
      client.ping(ping);
    }
  };

  return (
    <div>
      <Board
        tokens={tokens}
        pings={pings}
        onTokenCreated={createToken}
        onTokenDeleted={deleteToken}
        onTokenMoved={updateToken}
        onPingCreated={createPing}
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
