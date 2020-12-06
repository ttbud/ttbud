import {
  BoardStateApiClient,
  ConnectionError,
  EventType,
} from "./BoardStateApiClient";
import { Dispatch, Middleware, MiddlewareAPI } from "@reduxjs/toolkit";
import BoardSyncer from "./BoardSyncer";
import {
  connected,
  connecting,
  ConnectionStateType,
  disconnected,
} from "../ui/connection-state/connection-state-slice";
import { RootState } from "../store/rootReducer";

/**
 * Sync network state and ui state
 */
export function networkSyncMiddleware(
  apiClient: BoardStateApiClient
): Middleware {
  return (store: MiddlewareAPI<Dispatch, RootState>) => {
    const boardSyncer = new BoardSyncer(apiClient, store);
    let retryTimeoutId: number | undefined = undefined;

    apiClient.setEventHandler((event) => {
      switch (event.type) {
        case EventType.Connected:
          store.dispatch(connected());
          break;
        case EventType.Disconnected:
          const state = store.getState().connectionState;
          const waitTimeSecs =
            state.type === ConnectionStateType.Connecting ||
            state.type === ConnectionStateType.Disconnected
              ? Math.pow(state.numRetries, 2)
              : 0;
          if (event.error === ConnectionError.UNKNOWN) {
            if (retryTimeoutId) {
              window.clearTimeout(retryTimeoutId);
            }
            retryTimeoutId = window.setTimeout(
              apiClient.reconnect.bind(apiClient),
              waitTimeSecs * 1000
            );
          }

          store.dispatch(disconnected({ error: event.error }));
          break;
        case EventType.Connecting:
          store.dispatch(connecting());
          break;
        case EventType.InitialState:
          boardSyncer.onNetworkTokenUpdate(event.tokens);
          break;
        case EventType.TokenUpdate:
          boardSyncer.onNetworkTokenUpdate(event.tokens, event.requestId);
          break;
        case EventType.Error:
          if (event.requestId) {
            boardSyncer.onNetworkUpdateRejected(event.requestId);
          }
          console.log(event.rawMessage);
          break;
      }
    });

    return (next) => (action) => {
      const result = next(action);
      boardSyncer.onUiTokenUpdate(store.getState().board.tokens);

      return result;
    };
  };
}
