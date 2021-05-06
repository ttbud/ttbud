import { Ping, Token } from "../types";

export enum EventType {
  Update = "update",
  Connecting = "connecting",
  Connected = "connected",
  InitialState = "initial state",
  Error = "error",
  Disconnected = "disconnected",
}

interface UpsertAction {
  type: "upsert";
  token: Token;
}

interface DeleteAction {
  type: "delete";
  entityId: string;
}

interface PingAction {
  type: "ping";
  ping: Ping;
}

export type Action = UpsertAction | DeleteAction | PingAction;

interface UpdateEvent {
  type: EventType.Update;
  requestId: string;
  actions: Action[];
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
  | UpdateEvent
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
  send(requestId: string, actions: Action[]): void;
}
