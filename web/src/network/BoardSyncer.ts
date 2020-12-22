import BoardStateApiClient from "./BoardStateApiClient";
import { getLocalState, getNetworkUpdates, Update } from "./board-state-diff";
import { v4 as uuid } from "uuid";
import throttle from "../util/throttle";
import { Entity } from "../types";

const UPDATE_RATE_MS = 250;

export default class BoardSyncer {
  /**
   * Updates that we've sent to the server but haven't heard back about yet
   */
  private readonly unackedUpdates = new Map<string, Update[]>();

  /**
   * The most recent network state we've received
   */
  private networkTokens: Entity[] = [];

  /**
   * The last UI tokens we processed, used to quickly bail if we get an update that changes nothing
   */
  private lastUiTokens: Entity[] | undefined = [];
  private readonly sendNetworkUpdatesThrottled: (uiTokens: Entity[]) => void;

  constructor(private readonly apiClient: BoardStateApiClient) {
    this.sendNetworkUpdatesThrottled = throttle(
      this.sendNetworkUpdates.bind(this),
      UPDATE_RATE_MS
    );
  }

  onNetworkTokenUpdate(
    uiTokens: Entity[],
    networkTokens: Entity[],
    requestId?: string
  ): Entity[] {
    this.sendNetworkUpdates(uiTokens);
    this.lastUiTokens = uiTokens;
    if (requestId) {
      this.unackedUpdates.delete(requestId);
    }
    this.networkTokens = networkTokens;

    return getLocalState(
      networkTokens,
      Array.from(this.unackedUpdates.values()).flat()
    );
  }

  onNetworkUpdateRejected(requestId: string) {}

  onUiTokenUpdate(tokens: Entity[]) {
    if (tokens !== this.lastUiTokens) {
      this.sendNetworkUpdatesThrottled(tokens);
    }
  }

  private sendNetworkUpdates(uiTokens: Entity[]) {
    if (!this.apiClient.connected()) {
      this.unackedUpdates.clear();
      return;
    }

    const updates = getNetworkUpdates({
      networkTokens: this.networkTokens,
      uiTokens: uiTokens,
      unackedUpdates: Array.from(this.unackedUpdates.values()).flat(),
    });

    if (updates.length === 0) {
      return;
    }

    const requestId = uuid();
    this.apiClient.send(requestId, updates);
    this.unackedUpdates.set(requestId, updates);
  }
}
