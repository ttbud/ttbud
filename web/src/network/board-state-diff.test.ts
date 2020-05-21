import {
  getLocalState,
  getNetworkUpdates,
  UpdateType,
} from "./board-state-diff";
import { ContentType, Entity, EntityType } from "../types";

const TOKEN_1: Entity = {
  id: "token-1",
  type: EntityType.Character,
  contents: { type: ContentType.Icon, iconId: "icon-id" },
  pos: {
    x: 0,
    y: 0,
    z: 0,
  },
};

const MOVED_TOKEN_1: Entity = {
  id: "token-1",
  type: EntityType.Character,
  contents: { type: ContentType.Icon, iconId: "icon-id" },
  pos: {
    x: 1,
    y: 1,
    z: 1,
  },
};

const TOKEN_2: Entity = {
  id: "token-2",
  type: EntityType.Character,
  contents: { type: ContentType.Icon, iconId: "icon-id" },
  pos: {
    x: 2,
    y: 2,
    z: 2,
  },
};

describe("getNetworkUpdates", () => {
  it("should return an empty list when they're the same", () => {
    expect(
      getNetworkUpdates({ networkTokens: [], uiTokens: [], unackedUpdates: [] })
    ).toEqual([]);
  });

  it("should return a delete when network has a token ui doesn't", () => {
    expect(
      getNetworkUpdates({
        networkTokens: [TOKEN_1],
        uiTokens: [],
        unackedUpdates: [],
      })
    ).toEqual([
      {
        type: "delete",
        tokenId: TOKEN_1.id,
      },
    ]);
  });

  it("should return a create when ui has a token network doesn't", () => {
    expect(
      getNetworkUpdates({
        networkTokens: [],
        uiTokens: [TOKEN_1],
        unackedUpdates: [],
      })
    ).toEqual([
      {
        type: "create",
        token: TOKEN_1,
      },
    ]);
  });

  it("should not return a create if it already exists in unackedUpdates", () => {
    expect(
      getNetworkUpdates({
        networkTokens: [],
        uiTokens: [TOKEN_1],
        unackedUpdates: [
          {
            type: UpdateType.CREATE,
            token: TOKEN_1,
          },
        ],
      })
    ).toEqual([]);
  });

  it("should not return a delete if it already exists in unackedUpdates", () => {
    expect(
      getNetworkUpdates({
        networkTokens: [TOKEN_1],
        uiTokens: [],
        unackedUpdates: [
          {
            type: UpdateType.DELETE,
            tokenId: TOKEN_1.id,
          },
        ],
      })
    ).toEqual([]);
  });

  it("should return a move if the token has been moved", () => {
    expect(
      getNetworkUpdates({
        networkTokens: [TOKEN_1],
        uiTokens: [MOVED_TOKEN_1],
        unackedUpdates: [],
      })
    ).toEqual([
      {
        type: "move",
        token: MOVED_TOKEN_1,
      },
    ]);
  });
});

describe("getLocalState", () => {
  it("should return a state including an unacked create update", () => {
    expect(
      getLocalState([TOKEN_1], [{ type: UpdateType.CREATE, token: TOKEN_2 }])
    ).toEqual([TOKEN_1, TOKEN_2]);
  });

  it("should return a state not including an unacked delete update", () => {
    expect(
      getLocalState(
        [TOKEN_1],
        [{ type: UpdateType.DELETE, tokenId: TOKEN_1.id }]
      )
    ).toEqual([]);
  });

  it("should return a state including an unacked move update", () => {
    expect(
      getLocalState(
        [TOKEN_1],
        [{ type: UpdateType.MOVE, token: MOVED_TOKEN_1 }]
      )
    ).toEqual([MOVED_TOKEN_1]);
  });
});
