import { Update } from "./board-state-diff";
import { Entity } from "../types";

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

export enum ConnectionError {
  ROOM_FULL = "room full",
  INVALID_ROOM_ID = "invalid room id",
  TOO_MANY_CONNECTIONS = "too many connections",
  TOO_MANY_ROOMS_CREATED = "too many new rooms",
  UNKNOWN = "unknown",
}

interface ConnectionStatusDisconnected {
  type: EventType.Disconnected;
  error: ConnectionError;
}

export type ConnectionStatusEvent =
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

export default interface BoardStateApiClient {
  setEventHandler(handler: ApiEventHandler): void;
  connect(roomId: string): void;
  reconnect(): void;
  connected(): boolean;
  close(): void;
  send(requestId: string, updates: Update[]): void;
}
