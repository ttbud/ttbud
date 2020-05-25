import { BoardStateApiClient, EventType } from "./BoardStateApiClient";
import WS from "jest-websocket-mock";
import { ContentType, EntityType, Ping, Token } from "../types";
import { UpdateType } from "./board-state-diff";
import { ApiPingToken } from "./api-types";

const API_CHARACTER = {
  type: "character",
  contents: { text: "text-contents" },
  id: "token-id",
  start_x: 1,
  start_y: 1,
  start_z: 1,
  end_x: 2,
  end_y: 2,
  end_z: 2,
  color_rgb: {
    red: 255,
    green: 255,
    blue: 255,
  },
};

const CHARACTER: Token = {
  type: EntityType.Character,
  color: {
    red: API_CHARACTER.color_rgb.red,
    green: API_CHARACTER.color_rgb.green,
    blue: API_CHARACTER.color_rgb.blue,
  },
  contents: { type: ContentType.Text, text: API_CHARACTER.contents.text },
  id: API_CHARACTER.id,
  pos: {
    x: API_CHARACTER.start_x,
    y: API_CHARACTER.start_y,
    z: API_CHARACTER.start_z,
  },
};

const VALID_API_PING: ApiPingToken = {
  type: "ping",
  id: "ping-id",
  x: 1,
  y: 1,
};

const VALID_PING: Ping = {
  id: VALID_API_PING.id,
  pos: { x: VALID_API_PING.x, y: VALID_API_PING.y },
  type: EntityType.Ping,
};

describe("BoardStateApiClient", () => {
  let eventHandler: jest.Mock;
  let api: WS;
  let client: BoardStateApiClient;

  beforeEach(async () => {
    WS.clean();

    api = new WS("ws://ttbud.local/roomId", { jsonProtocol: true });
    client = new BoardStateApiClient("ws://ttbud.local");

    client.connect("roomId");
    await api.connected;

    eventHandler = jest.fn();
    client.setEventHandler(eventHandler);
  });

  it("notifies listeners of connections", async () => {
    api = new WS("ws://localhost/roomId", { jsonProtocol: true });
    client = new BoardStateApiClient("ws://localhost");

    eventHandler = jest.fn();
    client.setEventHandler(eventHandler);

    client.connect("roomId");
    await api.connected;

    expect(eventHandler).toHaveBeenCalledWith({ type: EventType.Connected });
  });

  it("disconnects after a connection timeout", async () => {
    api = new WS("ws://localhost/roomId", { jsonProtocol: true });
    client = new BoardStateApiClient("ws://localhost");

    eventHandler = jest.fn();
    client.setEventHandler(eventHandler);

    client.connect("roomId");
    await api.connected;

    expect(eventHandler).toHaveBeenCalledWith({ type: EventType.Connected });
  });

  it("notifies listeners of initial state", async () => {
    client.connect("roomId");
    await api.connected;
    api.send({ type: "connected", data: [] });
    expect(eventHandler).toBeCalledWith({ type: "initial state", tokens: [] });
  });

  it("notifies listeners of message decoding errors", async () => {
    api.send({ invalid: "message" });
    expect(eventHandler.mock.calls[0]).toMatchObject([{ type: "error" }]);
  });

  it("notifies listeners of error messages", async () => {
    const message = {
      type: "error",
      request_id: "request-id",
      data: "raw error message",
    };
    api.send(message);

    expect(eventHandler).toHaveBeenCalledWith({
      type: "error",
      requestId: "request-id",
      rawMessage: JSON.stringify(message),
      error: new Error("raw error message"),
    });
    expect(eventHandler.mock.calls[0]).toMatchObject([{ type: "error" }]);
  });

  it("notifies listeners of token updates", async () => {
    api.send({
      type: "state",
      request_id: "request-id",
      data: [API_CHARACTER],
    });

    expect(eventHandler).toHaveBeenCalledWith({
      type: "tokens",
      requestId: "request-id",
      tokens: [CHARACTER],
    });
  });

  it("sends token creates", async () => {
    client.send("request-id", [
      {
        type: UpdateType.CREATE,
        token: CHARACTER,
      },
    ]);

    await expect(api).toReceiveMessage({
      request_id: "request-id",
      updates: [
        {
          // Creates and updates are sent as "update"
          action: "update",
          data: API_CHARACTER,
        },
      ],
    });
  });

  it("sends pings", async () => {
    client.send("request-id", [
      {
        type: UpdateType.CREATE,
        token: VALID_PING,
      },
    ]);

    await expect(api).toReceiveMessage({
      request_id: "request-id",
      updates: [
        {
          // Creates and updates are sent as "update"
          action: "ping",
          data: VALID_API_PING,
        },
      ],
    });
  });
});
