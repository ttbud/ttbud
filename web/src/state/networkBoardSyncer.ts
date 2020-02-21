import {
  BoardStateApiClient,
  EventType,
  Token
} from "../network/BoardStateApiClient";
import { Middleware } from "@reduxjs/toolkit";
import { replaceTokens } from "./board-slice";
import {
  getLocalState,
  getNetworkUpdates,
  Update
} from "../network/board-state-diff";
import uuid from "uuid";

/**
 * Watch sync board changes between network and ui
 */
export function networkBoardSyncer(apiClient: BoardStateApiClient): Middleware {
  let unackedUpdates = new Map<string, Update[]>();
  let networkTokens: Token[] = [];

  return store => {
    apiClient.setEventHandler(event => {
      switch (event.type) {
        case EventType.INITIAL_STATE:
          networkTokens = event.tokens;
          store.dispatch(replaceTokens(event.tokens));
          break;
        case EventType.TOKEN_UPDATE:
          networkTokens = event.tokens;
          unackedUpdates.delete(event.requestId);
          const localState = getLocalState(
            event.tokens,
            Array.from(unackedUpdates.values()).flat()
          );

          store.dispatch(replaceTokens(localState));
          break;
        case EventType.ERROR:
          if (event.requestId) {
            unackedUpdates.delete(event.requestId);
          }
          console.log(event.rawMessage);
          break;
      }
    });

    return next => action => {
      const result = next(action);
      const state = store.getState();
      const updates = getNetworkUpdates({
        networkTokens,
        uiTokens: state.board.tokens,
        unackedUpdates: Array.from(unackedUpdates.values()).flat()
      });

      if (updates.length === 0) {
        return;
      }

      const requestId = uuid();
      apiClient.send(requestId, updates);
      unackedUpdates.set(requestId, updates);

      return result;
    };
  };
}
