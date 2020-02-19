import * as t from "io-ts";
import decode from "../util/decode";
import { GRID_SIZE_PX } from "../config";
import noop from "../util/noop";
import { Update } from "./board-state-diff";

const PingMessage = t.type({
  type: t.literal("ping"),
  request_id: t.string,
  data: t.type({
    id: t.string,
    x: t.number,
    y: t.number
  })
});

const BoardStateMessage = t.type({
  type: t.literal("state"),
  request_id: t.string,
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

export function toApiToken(token: Token) {
  return {
    id: token.id,
    icon_id: token.iconId,
    start_x: token.x,
    start_y: token.y,
    start_z: token.z,
    end_x: token.x + 1,
    end_y: token.y + 1,
    end_z: token.z + 1
  };
}

type ApiToken = ReturnType<typeof toApiToken>;

interface CreateOrUpdateTokenMessage {
  action: "create" | "update";
  request_id: string;
  data: ApiToken;
}

interface DeleteTokenMessage {
  action: "delete";
  request_id: string;
  data: string;
}

export type QueueableMessage = CreateOrUpdateTokenMessage | DeleteTokenMessage;

export interface Token {
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

export enum EventType {
  TOKEN_UPDATE = "tokens",
  PING = "ping",
  CONNECT = "connect",
  ERROR = "error",
  DISCONNECT = "disconnect"
}

interface BoardStateEvent {
  type: EventType.TOKEN_UPDATE;
  requestId: string;
  tokens: Token[];
}

interface PingEvent {
  type: EventType.PING;
  requestId: string;
  ping: Ping;
}

interface ConnectionStatusEvent {
  type: EventType.DISCONNECT | EventType.CONNECT;
}

interface ErrorEvent {
  type: EventType.ERROR;
  error: Error;
  /**
   * The raw message received from the server that triggered the error
   */
  rawMessage: string;
}

export type Event =
  | BoardStateEvent
  | PingEvent
  | ConnectionStatusEvent
  | ErrorEvent;

export type ApiEventHandler = (event: Event) => void;

export class BoardStateApiClient {
  private updates: QueueableMessage[] = [];
  private eventHandler: ApiEventHandler = noop;
  private socket: WebSocket | undefined;

  public constructor(
    private readonly hostBaseUrl: string,
    private readonly websocketFactory: (url: string) => WebSocket
  ) {}

  public setEventHandler(listener: ApiEventHandler) {
    this.eventHandler = listener;
  }

  public connect(roomId: string) {
    const encodedRoomId = encodeURIComponent(roomId);

    if (this.socket) {
      //TODO: Real number and reason
      this.socket.close();
    }

    this.socket = this.websocketFactory(`${this.hostBaseUrl}/${encodedRoomId}`);
    this.socket.addEventListener("open", this.onConnect.bind(this));
    this.socket.addEventListener("message", this.onMessage.bind(this));
    //TODO: Handle errors
    this.socket.addEventListener("error", console.log.bind(console));
    this.socket.addEventListener("close", this.onClose.bind(this));
  }

  public close() {
    this.socket?.close();
  }

  public delete(tokenId: string, requestId: string) {
    this.updates.push({
      action: "delete",
      request_id: requestId,
      data: tokenId
    });
    this.scheduleSendEvent();
  }

  public create(token: Token, requestId: string) {
    this.updates.push({
      action: "create",
      request_id: requestId,
      data: toApiToken(token)
    });
    this.scheduleSendEvent();
  }

  public upsert(token: Token, requestId: string) {
    this.updates.push({
      action: "update",
      request_id: requestId,
      data: toApiToken(token)
    });
    this.scheduleSendEvent();
  }

  public send(requestId: string, updates: Update[]) {
    const batchedUpdates = [];
    for (const update of updates) {
      switch (update.type) {
        case "create":
        case "move":
          batchedUpdates.push({
            action: "update",
            data: toApiToken(update.token)
          });
          break;
        case "delete":
          batchedUpdates.push({
            action: "delete",
            data: update.tokenId
          });
          break;
        case "ping":
          // const requestId = uuid();
          // requestIds.push(requestId);
          // this.socket?.send(
          //   JSON.stringify({
          //     action: "ping",
          //     request_id: requestId,
          //     data: {
          //       id: update.ping.id,
          //       x: update.ping.x,
          //       y: update.ping.y
          //     }
          //   })
          // );
          break;
      }
    }

    const toSend = {
      request_id: requestId,
      updates: batchedUpdates
    };
    console.log("sending", toSend);
    this.socket?.send(JSON.stringify(toSend));
  }

  public ping(ping: Ping, requestId: string) {
    this.socket?.send(
      JSON.stringify([
        {
          action: "ping",
          request_id: requestId,
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
    this.sendEvents();
    // if (this.updateCallback != null) {
    //   window.clearTimeout(this.updateCallback);
    // }
    // this.updateCallback = window.setTimeout(this.sendEvents.bind(this), 200);
  }

  private isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  private sendEvents() {
    if (!this.isConnected()) {
      console.log("not connected");
      return;
    }
    this.socket?.send(JSON.stringify(this.updates));
    this.updates = [];
  }

  private onConnect() {
    console.log("connected");
    this.eventHandler({ type: EventType.CONNECT });
  }

  private onClose() {
    console.log("disconnected");
    this.eventHandler({ type: EventType.DISCONNECT });
  }

  private onMessage(event: MessageEvent) {
    try {
      const json = JSON.parse(event.data);
      const message = decode(MessageDecoder, json);
      console.log({ message });
      if (message.type === "ping") {
        this.eventHandler({
          type: EventType.PING,
          requestId: message.request_id,
          ping: {
            id: message.data.id,
            x: message.data.x,
            y: message.data.y
          }
        });
      } else {
        this.eventHandler({
          type: EventType.TOKEN_UPDATE,
          requestId: message.request_id,
          tokens: message.data.map(tokenState => ({
            id: tokenState.id,
            x: tokenState.start_x,
            y: tokenState.start_y,
            z: tokenState.start_z,
            iconId: tokenState.icon_id
          }))
        });
      }
    } catch (e) {
      this.eventHandler({
        type: EventType.ERROR,
        error: e,
        rawMessage: event.data
      });
    }
  }
}
