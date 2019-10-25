import * as t from "io-ts";
import { decode } from "../util/decode-util";
import { useAsyncEffect } from "../util/use-util";

const TokenStateDecoder = t.type({
  id: t.string,
  x: t.number,
  y: t.number,
  icon: t.string
});

const StateDecoder = t.array(TokenStateDecoder);

export type TokenState = t.TypeOf<typeof TokenStateDecoder>;

export const useTokenState = (
  roomId: string | null,
  onUpdate: (state: TokenState[]) => {}
) => {
  useAsyncEffect({
    effect: async () => {
      const resp = await fetch("http://192.168.0.105:5000/api/socket");
      const json = await resp.json();
      const socketUrl = json.path;
      const socket = new WebSocket(socketUrl);
      return new TokenStateClient(socket, onUpdate);
    },
    deps: [roomId],
    cleanup: (client: TokenStateClient) => {
      client.close();
    }
  });
};

export class TokenStateClient {
  public constructor(
    private readonly socket: WebSocket,
    private readonly onStateUpdate: (state: TokenState[]) => void
  ) {
    socket.addEventListener("open", TokenStateClient.onConnect);
    socket.addEventListener("message", this.onMessage);
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
        action: "create",
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
    this.onStateUpdate(decode(StateDecoder, json));
  }

  private static onClose() {
    console.log("disconnected");
  }
}

export default useTokenState;
