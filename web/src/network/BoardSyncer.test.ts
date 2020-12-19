import BoardSyncer from "./BoardSyncer";
import { ContentType, Entity, EntityType } from "../types";
import FakeApiClient from "./__test_util__/FakeApiClient";

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

describe("BoardSyncer", () => {
  let client: FakeApiClient;
  let syncer: BoardSyncer;

  beforeEach(() => {
    client = new FakeApiClient();
    syncer = new BoardSyncer(client);

    client.connect("room-id");
  });

  it("should remove rejected tokens", () => {
    syncer.onUiTokenUpdate([TOKEN_1]);
    const requestId = client.sentRequestIds()[0];
    syncer.onNetworkUpdateRejected(requestId);
    const result = syncer.onNetworkTokenUpdate([TOKEN_1], [], requestId);
    expect(result).toHaveLength(0);
  });
});
