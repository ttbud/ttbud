import * as t from "io-ts";
import { decode } from "../util/decode-util";
import { GRID_SIZE_PX } from "../config";

const TokenStateDecoder = t.type({
  id: t.string,
  start_x: t.number,
  start_y: t.number,
  start_z: t.number,
  icon_id: t.string
});

const StateDecoder = t.array(TokenStateDecoder);

export interface TokenState {
  id: string;
  x: number;
  y: number;
  z: number;
  iconId: string;
}

export class TokenStateClient {
  private updateCallback: null | number = null;
  private updates: any[] = [];

  public constructor(
    private readonly socket: WebSocket,
    private readonly onStateUpdate: (state: TokenState[]) => void
  ) {
    socket.addEventListener("open", TokenStateClient.onConnect);
    socket.addEventListener("message", this.onMessage.bind(this));
    socket.addEventListener("close", TokenStateClient.onClose);
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
      data: tokenId,
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
    this.onStateUpdate(
      decode(StateDecoder, json).map(tokenState => ({
        id: tokenState.id,
        x: tokenState.start_x * GRID_SIZE_PX,
        y: tokenState.start_y * GRID_SIZE_PX,
        z: tokenState.start_z,
        iconId: tokenState.icon_id
      }))
    );
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
