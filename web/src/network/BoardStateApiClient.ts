import * as t from "io-ts";
import decode from "../util/decode";
import { Update, UpdateType } from "./board-state-diff";
import UnreachableCaseError from "../util/UnreachableCaseError";
import Pos2d, { Pos3d } from "../util/shape-math";
import noop from "../util/noop";

const PingTokenDecoder = t.type({
  id: t.string,
  type: t.literal("ping"),
  x: t.number,
  y: t.number,
});

const ColorDecoder = t.type({
  red: t.number,
  green: t.number,
  blue: t.number,
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
  end_z: t.number,
  color_rgb: t.union([ColorDecoder, t.undefined]),
});

const ApiTokenDecoder = t.union([IconTokenDecoder, PingTokenDecoder]);

const BoardStateDecoder = t.type({
  type: t.literal("state"),
  request_id: t.string,
  data: t.array(ApiTokenDecoder),
});

const ErrorMessageDecoder = t.type({
  type: t.literal("error"),
  request_id: t.string,
  data: t.string,
});

const ConnectionResultDecoder = t.type({
  type: t.literal("connected"),
  data: t.array(ApiTokenDecoder),
});

const MessageDecoder = t.union([
  BoardStateDecoder,
  ErrorMessageDecoder,
  ConnectionResultDecoder,
]);

type ApiPingToken = t.TypeOf<typeof PingTokenDecoder>;
type ApiIconToken = t.TypeOf<typeof IconTokenDecoder>;
type ApiToken = t.TypeOf<typeof ApiTokenDecoder>;

export enum TokenType {
  Character = "character",
  Floor = "floor",
  Ping = "ping",
}

export interface PingToken {
  type: TokenType.Ping;
  id: string;
  pos: Pos2d;
}

export interface Color {
  red: number;
  green: number;
  blue: number;
}

// TODO: Split into character and floor tokens
export interface IconToken {
  type: TokenType.Character | TokenType.Floor;
  id: string;
  pos: Pos3d;
  iconId: string;
  color?: Color;
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
      if (update.token.type === TokenType.Ping) {
        const { id, type, pos } = update.token;
        return {
          action: "ping",
          data: { id, type, x: pos.x, y: pos.y },
        };
      } else {
        const { id, type, iconId, pos, color } = update.token;
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
            end_z: pos.z + 1,
            color_rgb: color,
          },
        };
      }
    case UpdateType.DELETE:
      return {
        action: "delete",
        data: update.tokenId,
      };
    default:
      throw new UnreachableCaseError(update);
  }
}

function toToken(apiToken: ApiToken): Token {
  switch (apiToken.type) {
    case "ping":
      return {
        type: TokenType.Ping,
        id: apiToken.id,
        pos: {
          x: apiToken.x,
          y: apiToken.y,
        },
      };
    case "character":
      return {
        id: apiToken.id,
        type: apiToken.type as TokenType.Character,
        iconId: apiToken.icon_id,
        pos: {
          x: apiToken.start_x,
          y: apiToken.start_y,
          z: apiToken.start_z,
        },
        color: apiToken.color_rgb,
      };
    case "floor":
      return {
        id: apiToken.id,
        type: apiToken.type as TokenType.Floor,
        iconId: apiToken.icon_id,
        pos: {
          x: apiToken.start_x,
          y: apiToken.start_y,
          z: apiToken.start_z,
        },
      };
    default:
      throw new UnreachableCaseError(apiToken);
  }
}

export enum EventType {
  TokenUpdate = "tokens",
  Connecting = "connecting",
  Connected = "connected",
  InitialState = "initial state",
  Error = "error",
  Disconnected = "disconnected",
}

interface BoardStateEvent {
  type: EventType.TokenUpdate;
  requestId: string;
  tokens: Token[];
}

enum DisconnectErrorCode {
  InvalidUuid = 4001,
  RoomFull = 4002,
}

export enum ConnectionError {
  ROOM_FULL = "room full",
  INVALID_ROOM_ID = "invalid room id",
  UNKNOWN = "unknown",
}

interface ConnectionStatusDisconnected {
  type: EventType.Disconnected;
  error: ConnectionError;
}

type ConnectionStatusEvent =
  | { type: EventType.Connected | EventType.Connecting }
  | ConnectionStatusDisconnected;

interface InitialStateEvent {
  type: EventType.InitialState;
  tokens: Token[];
}

interface ErrorEvent {
  type: EventType.Error;
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

// See https://tools.ietf.org/html/rfc6455#section-7.4.1
const WS_CODE_GOING_AWAY = 1001;
const CONNECTION_TIMEOUT_MS = 5000;

export class BoardStateApiClient {
  private eventHandler: ApiEventHandler = noop;
  private socket: WebSocket | undefined;
  private connectionTimeoutListenerId: number | null = null;

  public constructor(
    private readonly hostBaseUrl: string,
    private readonly websocketFactory: (url: string) => WebSocket
  ) {}

  public setEventHandler(handler: ApiEventHandler) {
    this.eventHandler = handler;
  }

  public connect(roomId: string) {
    const encodedRoomId = encodeURIComponent(roomId);

    if (this.socket) {
      this.socket.close(WS_CODE_GOING_AWAY, "Going away");
    }

    this.eventHandler({ type: EventType.Connected });
    this.socket = this.websocketFactory(`${this.hostBaseUrl}/${encodedRoomId}`);
    this.connectionTimeoutListenerId = window.setTimeout(
      () => this.close(),
      CONNECTION_TIMEOUT_MS
    );
    this.socket.addEventListener("open", this.onConnect.bind(this));
    this.socket.addEventListener("message", this.onMessage.bind(this));
    //TODO: Handle errors
    this.socket.addEventListener("error", console.log.bind(console));
    this.socket.addEventListener("close", this.onClose.bind(this));
  }

  public close() {
    this.socket?.close();
    this.eventHandler({
      type: EventType.Disconnected,
      error: ConnectionError.UNKNOWN,
    });
  }

  public send(requestId: string, updates: Update[]) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          request_id: requestId,
          updates: updates.map(toApiUpdate),
        })
      );
    } else {
      console.warn("dropping message to disconnected host");
    }
  }

  private onConnect() {
    console.log("connected");
    if (this.connectionTimeoutListenerId) {
      window.clearTimeout(this.connectionTimeoutListenerId);
    }
    this.eventHandler({ type: EventType.Connected });
  }
  private onClose(e: CloseEvent) {
    console.log("disconnected", e);
    this.eventHandler({
      type: EventType.Disconnected,
      error: this.disconnectReason(e.code),
    });
  }

  private onMessage(event: MessageEvent) {
    let message;
    try {
      const json = JSON.parse(event.data);
      message = decode(MessageDecoder, json);
    } catch (e) {
      this.eventHandler({
        type: EventType.Error,
        error: e,
        rawMessage: event.data,
      });
      return;
    }

    switch (message.type) {
      case "state":
        this.eventHandler({
          type: EventType.TokenUpdate,
          requestId: message.request_id,
          tokens: message.data.map(toToken),
        });
        break;
      case "error":
        this.eventHandler({
          type: EventType.Error,
          requestId: message.request_id,
          rawMessage: event.data,
          error: new Error(message.data),
        });
        break;
      case "connected":
        this.eventHandler({
          type: EventType.InitialState,
          tokens: message.data.map(toToken),
        });
        break;
      default:
        throw new UnreachableCaseError(message);
    }
  }

  private disconnectReason(disconnectCode: number): ConnectionError {
    switch (disconnectCode) {
      case DisconnectErrorCode.InvalidUuid:
        return ConnectionError.INVALID_ROOM_ID;
      case DisconnectErrorCode.RoomFull:
        return ConnectionError.ROOM_FULL;
      default:
        return ConnectionError.UNKNOWN;
    }
  }
}
