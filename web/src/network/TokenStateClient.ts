import * as t from "io-ts";
import { decode } from "../util/decode-util";
import { GRID_SIZE_PX } from "../config";
import uuid from "uuid";

const PingMessage = t.type({
  type: t.literal("ping"),
  data: t.type({
    id: t.string,
    x: t.number,
    y: t.number
  })
});

const BoardStateMessage = t.type({
  type: t.literal("state"),
  data: t.array(
    t.type({
      id: t.string,
      start_x: t.number,
      start_y: t.number,
      start_z: t.number,
      icon_id: t.string
    })
  )
});

const MessageDecoder = t.union([PingMessage, BoardStateMessage]);

export interface TokenState {
  id: string;
  x: number;
  y: number;
  z: number;
  iconId: string;
}

export interface Ping {
  id: string;
  x: number;
  y: number;
}

type StateListener = (state: TokenState[]) => void;
type PingListener = (ping: Ping) => void;

export class TokenStateClient {
  private updateCallback: null | number = null;
  private updates: any[] = [];
  private stateListeners = new Map<string, StateListener>();
  private pingListeners = new Map<string, PingListener>();

  public constructor(private readonly socket: WebSocket) {
    socket.addEventListener("open", TokenStateClient.onConnect);
    socket.addEventListener("message", this.onMessage.bind(this));
    socket.addEventListener("close", TokenStateClient.onClose);
  }

  public addStateListener(listener: StateListener): string {
    const listenerId = uuid();
    this.stateListeners.set(listenerId, listener);
    return listenerId;
  }

  public removeStateListener(listenerId: string) {
    this.stateListeners.delete(listenerId);
  }

  public addPingListener(listener: PingListener): string {
    const listenerId = uuid();
    this.pingListeners.set(listenerId, listener);
    return listenerId;
  }

  public removePingListener(listenerId: string) {
    this.pingListeners.delete(listenerId);
  }

  public close() {
    if (this.isConnected()) {
      this.socket.close();
      TokenStateClient.onClose();
    }
  }

  public isConnected() {
    return this.socket.readyState === WebSocket.OPEN;
  }

  public queueDelete(tokenId: string) {
    this.updates.push({
      action: "delete",
      data: tokenId
    });
    this.scheduleSendEvent();
  }

  public queueCreate(token: TokenState) {
    this.updates.push({
      action: "create",
      data: TokenStateClient.toNetworkState(token)
    });
    this.scheduleSendEvent();
  }

  public queueUpdate(token: TokenState) {
    this.updates.push({
      action: "update",
      data: TokenStateClient.toNetworkState(token)
    });
    this.scheduleSendEvent();
  }

  public ping(ping: Ping) {
    this.socket.send(
      JSON.stringify([
        {
          action: "ping",
          data: {
            x: ping.x / GRID_SIZE_PX,
            y: ping.y / GRID_SIZE_PX,
            id: ping.id
          }
        }
      ])
    );
  }

  private scheduleSendEvent() {
    if (this.updateCallback != null) {
      window.clearTimeout(this.updateCallback);
    }
    this.updateCallback = window.setTimeout(this.sendEvents.bind(this), 200);
  }

  private sendEvents() {
    if (!this.isConnected()) {
      return;
    }
    console.log("UPDATES", this.updates);
    this.socket.send(JSON.stringify(this.updates));
    this.updates = [];
  }

  private static onConnect() {
    console.log("connected");
  }

  private onMessage(event: MessageEvent) {
    const json = JSON.parse(event.data);
    try {
      const message = decode(MessageDecoder, json);
      if (message.type === "ping") {
        for (const listener of this.pingListeners.values()) {
          listener({
            id: message.data.id,
            x: message.data.x * GRID_SIZE_PX,
            y: message.data.y * GRID_SIZE_PX
          });
        }
      } else {
        for (const listener of this.stateListeners.values()) {
          listener(
            message.data.map(tokenState => ({
              id: tokenState.id,
              x: tokenState.start_x * GRID_SIZE_PX,
              y: tokenState.start_y * GRID_SIZE_PX,
              z: tokenState.start_z,
              iconId: tokenState.icon_id
            }))
          );
        }
      }
    } catch (e) {
      console.log(e);
    }
  }

  private static toNetworkState(token: TokenState) {
    const normalized_x = token.x / GRID_SIZE_PX;
    const normalized_y = token.y / GRID_SIZE_PX;

    return {
      id: token.id,
      icon_id: token.iconId,
      start_x: normalized_x,
      start_y: normalized_y,
      start_z: token.z,
      end_x: normalized_x + 1,
      end_y: normalized_y + 1,
      end_z: token.z + 1
    };
  }

  private static onClose() {
    console.log("disconnected");
  }
}
