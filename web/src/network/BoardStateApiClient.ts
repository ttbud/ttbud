import * as t from "io-ts";
import decode from "../util/decode";
import noop from "../util/noop";
import { Update, UpdateType } from "./board-state-diff";
import UnreachableCaseError from "../util/UnreachableCaseError";
import Pos2d, { Pos3d } from "../util/shape-math";

const PingTokenDecoder = t.type({
  id: t.string,
  type: t.literal("ping"),
  x: t.number,
  y: t.number
});

const IconTokenDecoder = t.type({
  id: t.string,
  type: t.union([t.literal("character"), t.literal("floor")]),
  icon_id: t.string,
  start_x: t.number,
  start_y: t.number,
  start_z: t.number,
  end_x: t.number,
  end_y: t.number,
  end_z: t.number
});

const ApiTokenDecoder = t.union([IconTokenDecoder, PingTokenDecoder]);

const BoardStateDecoder = t.type({
  type: t.literal("state"),
  request_id: t.string,
  data: t.array(ApiTokenDecoder)
});

const ErrorMessageDecoder = t.type({
  type: t.literal("error"),
  request_id: t.string,
  error: t.string
});

const ConnectionResultDecoder = t.type({
  type: t.literal("connected"),
  data: t.array(ApiTokenDecoder)
});

const MessageDecoder = t.union([
  BoardStateDecoder,
  ErrorMessageDecoder,
  ConnectionResultDecoder
]);

type ApiPingToken = t.TypeOf<typeof PingTokenDecoder>;
type ApiIconToken = t.TypeOf<typeof IconTokenDecoder>;
type ApiToken = t.TypeOf<typeof ApiTokenDecoder>;

export enum TokenType {
  CHARACTER = "character",
  FLOOR = "floor",
  PING = "ping"
}

export interface PingToken {
  type: TokenType.PING;
  id: string;
  pos: Pos2d;
}

export interface IconToken {
  type: TokenType.CHARACTER | TokenType.FLOOR;
  id: string;
  pos: Pos3d;
  iconId: string;
}

export type Token = PingToken | IconToken;

interface PingApiUpdate {
  action: "ping";
  data: ApiPingToken;
}

interface IconApiUpdate {
  action: "update";
  data: ApiIconToken;
}

interface TokenDelete {
  action: "delete";
  data: string;
}

type ApiUpdate = PingApiUpdate | IconApiUpdate | TokenDelete;

function toApiUpdate(update: Update): ApiUpdate {
  switch (update.type) {
    case UpdateType.CREATE:
    case UpdateType.MOVE:
      if (update.token.type === TokenType.PING) {
        const { id, type, pos } = update.token;
        return {
          action: "ping",
          data: { id, type, x: pos.x, y: pos.y }
        };
      } else {
        const { id, type, iconId, pos } = update.token;
        return {
          action: "update",
          data: {
            id,
            type,
            icon_id: iconId,
            start_x: pos.x,
            start_y: pos.y,
            start_z: pos.z,
            end_x: pos.x + 1,
            end_y: pos.y + 1,
            end_z: pos.z + 1
          }
        };
      }
    case UpdateType.DELETE:
      return {
        action: "delete",
        data: update.tokenId
      };
    default:
      throw new UnreachableCaseError(update);
  }
}

function toToken(apiToken: ApiToken): Token {
  switch (apiToken.type) {
    case "ping":
      return {
        type: TokenType.PING,
        id: apiToken.id,
        pos: {
          x: apiToken.x,
          y: apiToken.y
        }
      };
    case "character":
    case "floor":
      return {
        id: apiToken.id,
        //TODO: Figure out why typescript doesn't like this
        // @ts-ignore
        type: apiToken.type,
        iconId: apiToken.icon_id,
        pos: {
          x: apiToken.start_x,
          y: apiToken.start_y,
          z: apiToken.start_z
        }
      };
    default:
      throw new UnreachableCaseError(apiToken);
  }
}

export enum EventType {
  TOKEN_UPDATE = "tokens",
  CONNECT = "connect",
  INITIAL_STATE = "initial state",
  ERROR = "error",
  DISCONNECT = "disconnect"
}

interface BoardStateEvent {
  type: EventType.TOKEN_UPDATE;
  requestId: string;
  tokens: Token[];
}

interface ConnectionStatusEvent {
  type: EventType.DISCONNECT | EventType.CONNECT;
}

interface InitialStateEvent {
  type: EventType.INITIAL_STATE;
  tokens: Token[];
}

interface ErrorEvent {
  type: EventType.ERROR;
  error: Error;
  requestId?: string;
  /**
   * The raw message received from the server that triggered the error
   */
  rawMessage: string;
}

export type Event =
  | BoardStateEvent
  | ConnectionStatusEvent
  | ErrorEvent
  | InitialStateEvent;

export type ApiEventHandler = (event: Event) => void;

export class BoardStateApiClient {
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

  public send(requestId: string, updates: Update[]) {
    this.socket?.send(
      JSON.stringify({
        request_id: requestId,
        updates: updates.map(toApiUpdate)
      })
    );
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
    let message;
    try {
      const json = JSON.parse(event.data);
      message = decode(MessageDecoder, json);
    } catch (e) {
      this.eventHandler({
        type: EventType.ERROR,
        error: e,
        rawMessage: event.data
      });
      return;
    }

    switch (message.type) {
      case "state":
        this.eventHandler({
          type: EventType.TOKEN_UPDATE,
          requestId: message.request_id,
          tokens: message.data.map(toToken)
        });
        break;
      case "error":
        this.eventHandler({
          type: EventType.ERROR,
          requestId: message.request_id,
          rawMessage: event.data,
          error: new Error(message.error)
        });
        break;
      case "connected":
        this.eventHandler({
          type: EventType.INITIAL_STATE,
          tokens: message.data.map(toToken)
        });
        break;
      default:
        throw new UnreachableCaseError(message);
    }
  }
}
