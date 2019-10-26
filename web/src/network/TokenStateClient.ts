import * as t from "io-ts";
import { decode } from "../util/decode-util";
import wall from "../icon/wall.svg";
import bear from "../icon/bear.svg";
import dwarf from "../icon/wall.svg";

const ICONS_BY_TYPE = new Map([
  ["wall", wall],
  ["bear", bear],
  ["dwarf", dwarf]
]);

const TokenStateDecoder = t.type({
  id: t.string,
  x: t.number,
  y: t.number,
  type: t.string
});

const StateDecoder = t.array(TokenStateDecoder);

type NetworkTokenState = t.TypeOf<typeof TokenStateDecoder>;

export interface TokenState {
  id: string;
  x: number;
  y: number;
  type: string;
  icon: string;
}

export class TokenStateClient {
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

  public sendDelete(tokenId: string) {
    if (!this.isConnected()) {
      return;
    }
    this.socket.send(
      JSON.stringify({
        action: "delete",
        data: { id: tokenId }
      })
    );
  }

  public sendCreate(token: TokenState) {
    if (!this.isConnected()) {
      return;
    }

    this.socket.send(
      JSON.stringify({
        action: "create",
        data: token
      })
    );
  }

  public sendUpdate(token: TokenState) {
    if (!this.isConnected()) {
      return;
    }
    this.socket.send(
      JSON.stringify({
        action: "update",
        data: token
      })
    );
  }

  private static onConnect() {
    console.log("connected");
  }

  private onMessage(event: MessageEvent) {
    const json = JSON.parse(event.data);
    this.onStateUpdate(
      decode(StateDecoder, json).map(tokenState => ({
        id: tokenState.id,
        x: tokenState.x,
        y: tokenState.y,
        type: tokenState.type,
        icon: ICONS_BY_TYPE.get(tokenState.type) || "ahhh"
      }))
    );
  }

  private static onClose() {
    console.log("disconnected");
  }
}
