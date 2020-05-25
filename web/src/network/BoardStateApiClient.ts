import decode from "../util/decode";
import { Update, UpdateType } from "./board-state-diff";
import UnreachableCaseError from "../util/UnreachableCaseError";
import noop from "../util/noop";
import {
  ApiEntity,
  ApiTokenContents,
  ApiUpdate,
  isTextContents,
  MessageDecoder,
} from "./api-types";
import { ContentType, Entity, EntityType, TokenContents } from "../types";

function toApiUpdate(update: Update): ApiUpdate {
  switch (update.type) {
    case UpdateType.CREATE:
    case UpdateType.MOVE:
      if (update.token.type === EntityType.Ping) {
        const { id, type, pos } = update.token;
        return {
          action: "ping",
          data: { id, type, x: pos.x, y: pos.y },
        };
      } else {
        const { id, type, contents, pos, color } = update.token;
        const apiContents =
          contents.type === ContentType.Text
            ? { text: contents.text }
            : { icon_id: contents.iconId };

        return {
          action: "update",
          data: {
            id,
            type,
            contents: apiContents,
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

function toContents(contents: ApiTokenContents): TokenContents {
  if (isTextContents(contents)) {
    return {
      type: ContentType.Text,
      text: contents.text,
    };
  } else {
    return {
      type: ContentType.Icon,
      iconId: contents.icon_id,
    };
  }
}

function toEntity(apiEntity: ApiEntity): Entity {
  switch (apiEntity.type) {
    case "ping":
      return {
        type: EntityType.Ping,
        id: apiEntity.id,
        pos: {
          x: apiEntity.x,
          y: apiEntity.y,
        },
      };
    case "character":
      return {
        id: apiEntity.id,
        type: apiEntity.type as EntityType.Character,
        contents: toContents(apiEntity.contents),
        pos: {
          x: apiEntity.start_x,
          y: apiEntity.start_y,
          z: apiEntity.start_z,
        },
        color: apiEntity.color_rgb,
      };
    case "floor":
      return {
        id: apiEntity.id,
        type: apiEntity.type as EntityType.Floor,
        contents: toContents(apiEntity.contents),
        pos: {
          x: apiEntity.start_x,
          y: apiEntity.start_y,
          z: apiEntity.start_z,
        },
      };
    default:
      throw new UnreachableCaseError(apiEntity);
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
  tokens: Entity[];
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
  tokens: Entity[];
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

function disconnectReason(disconnectCode: number): ConnectionError {
  switch (disconnectCode) {
    case DisconnectErrorCode.InvalidUuid:
      return ConnectionError.INVALID_ROOM_ID;
    case DisconnectErrorCode.RoomFull:
      return ConnectionError.ROOM_FULL;
    default:
      return ConnectionError.UNKNOWN;
  }
}

// See https://tools.ietf.org/html/rfc6455#section-7.4.1
const WS_CODE_CLOSE_NORMAL = 1000;
const CONNECTION_TIMEOUT_MS = 5000;

export class BoardStateApiClient {
  private eventHandler: ApiEventHandler = noop;
  private socket: WebSocket | undefined;
  private connectionTimeoutListenerId: number | null = null;

  public constructor(private readonly hostBaseUrl: string) {}

  public setEventHandler(handler: ApiEventHandler) {
    this.eventHandler = handler;
  }

  public connect(roomId: string) {
    const encodedRoomId = encodeURIComponent(roomId);

    if (this.socket) {
      this.socket.close(WS_CODE_CLOSE_NORMAL, "Connecting to another room");
    }

    this.socket = new WebSocket(`${this.hostBaseUrl}/${encodedRoomId}`);
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
      error: disconnectReason(e.code),
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
          tokens: message.data.map(toEntity),
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
          tokens: message.data.map(toEntity),
        });
        break;
      default:
        throw new UnreachableCaseError(message);
    }
  }
}
