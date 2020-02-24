import {
  BoardStateApiClient,
  EventType,
  Token
} from "../network/BoardStateApiClient";
import { Middleware } from "@reduxjs/toolkit";
import { BoardState, replaceTokens } from "./board-slice";
import {
  getLocalState,
  getNetworkUpdates,
  Update
} from "../network/board-state-diff";
import uuid from "uuid";
import throttle from "../util/throttle";

const UPDATE_RATE_MS = 60;

/**
 * Sync board changes between network and ui
 */
export function boardSyncer(apiClient: BoardStateApiClient): Middleware {
  let unackedUpdates = new Map<string, Update[]>();
  let networkTokens: Token[] = [];
  let lastTokens: Token[] | undefined = [];

  return store => {
    apiClient.setEventHandler(event => {
      switch (event.type) {
        case EventType.InitialState:
          networkTokens = event.tokens;
          store.dispatch(replaceTokens(event.tokens));
          break;
        case EventType.TokenUpdate:
          networkTokens = event.tokens;
          unackedUpdates.delete(event.requestId);
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

    const sendNetworkUpdates = throttle((state: BoardState) => {
      const updates = getNetworkUpdates({
        networkTokens,
        uiTokens: state.tokens,
        unackedUpdates: Array.from(unackedUpdates.values()).flat()
      });

      if (updates.length === 0) {
        return;
      }

      const requestId = uuid();
      apiClient.send(requestId, updates);
      unackedUpdates.set(requestId, updates);
    }, UPDATE_RATE_MS);

    return next => action => {
      const result = next(action);
      const state = store.getState();
      if (lastTokens !== state.board.tokens) {
        sendNetworkUpdates(state.board);
        lastTokens = state.board.tokens;
      }

      return result;
    };
  };
}
