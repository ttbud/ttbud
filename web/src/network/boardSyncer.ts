import { BoardStateApiClient, EventType, Token } from "./BoardStateApiClient";
import { Middleware } from "@reduxjs/toolkit";
import { BoardState, replaceTokens } from "../ui/board/board-slice";
import { getLocalState, getNetworkUpdates, Update } from "./board-state-diff";
import { v4 as uuid } from "uuid";
import throttle from "../util/throttle";

const UPDATE_RATE_MS = 60;

/**
 * Sync board changes between network and ui
 */
export function boardSyncer(apiClient: BoardStateApiClient): Middleware {
  let unackedUpdates = new Map<string, Update[]>();
  let networkTokens: Token[] = [];
  let lastTokens: Token[] | undefined = [];

  return (store) => {
    const sendNetworkUpdates = (state: BoardState) => {
      const updates = getNetworkUpdates({
        networkTokens,
        uiTokens: state.tokens,
        unackedUpdates: Array.from(unackedUpdates.values()).flat(),
      });

      if (updates.length === 0) {
        return;
      }

      const requestId = uuid();
      apiClient.send(requestId, updates);
      unackedUpdates.set(requestId, updates);
    };

    const sendNetworkUpdatesThrottled = throttle(
      sendNetworkUpdates,
      UPDATE_RATE_MS
    );

    apiClient.setEventHandler((event) => {
      switch (event.type) {
        case EventType.InitialState:
          networkTokens = event.tokens;
          store.dispatch(replaceTokens(event.tokens));
          break;
        case EventType.TokenUpdate:
          const state = store.getState();
          sendNetworkUpdates(state.board);
          lastTokens = state.board.tokens;
          unackedUpdates.delete(event.requestId);
          networkTokens = event.tokens;

          const localState = getLocalState(
            event.tokens,
            Array.from(unackedUpdates.values()).flat()
          );

          store.dispatch(replaceTokens(localState));
          break;
        case EventType.Error:
          if (event.requestId) {
            unackedUpdates.delete(event.requestId);
          }
          console.log(event.rawMessage);
          break;
      }
    });

    return (next) => (action) => {
      const result = next(action);
      const state = store.getState();
      if (lastTokens !== state.board.tokens) {
        sendNetworkUpdatesThrottled(state.board);
        lastTokens = state.board.tokens;
      }

      return result;
    };
  };
}
