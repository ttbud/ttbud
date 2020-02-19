import { getNetworkUpdates } from "./board-state-diff";
import { Token } from "./BoardStateApiClient";

const TOKEN_1: Token = {
  id: "token-1",
  iconId: "icon-id",
  x: 0,
  y: 0,
  z: 0
};

const MOVED_TOKEN_1: Token = {
  id: "token-1",
  iconId: "icon-id",
  x: 1,
  y: 1,
  z: 1
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
        unackedUpdates: []
      })
    ).toEqual([
      {
        type: "delete",
        tokenId: TOKEN_1.id
      }
    ]);
  });

  it("should return a create when ui has a token network doesn't", () => {
    expect(
      getNetworkUpdates({
        networkTokens: [],
        uiTokens: [TOKEN_1],
        unackedUpdates: []
      })
    ).toEqual([
      {
        type: "create",
        token: TOKEN_1
      }
    ]);
  });

  it("should not return a create if it already exists in unackedUpdates", () => {
    expect(
      getNetworkUpdates({
        networkTokens: [],
        uiTokens: [TOKEN_1],
        unackedUpdates: [
          {
            type: "create",
            token: TOKEN_1
          }
        ]
      })
    ).toEqual([]);
  });

  it("should not return a delete if it already exists in unackedUpdates", () => {
    
  });

  it("should return a move if the token has been moved", () => {
    expect(
      getNetworkUpdates({
        networkTokens: [TOKEN_1],
        uiTokens: [MOVED_TOKEN_1],
        unackedUpdates: []
      })
    ).toEqual([
      {
        type: "move",
        token: MOVED_TOKEN_1
      }
    ]);
  });
});
