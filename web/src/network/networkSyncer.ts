import { BoardStateApiClient, EventType } from "./BoardStateApiClient";
import { Middleware } from "@reduxjs/toolkit";
import BoardSyncer from "./BoardSyncer";
import {
  setConnectionState,
  ConnectionStateType,
} from "../ui/connection-state/connection-state-slice";

/**
 * Sync network state and ui state
 */
export function networkSyncer(apiClient: BoardStateApiClient): Middleware {
  return (store) => {
    const boardSyncer = new BoardSyncer(apiClient, store);

    apiClient.setEventHandler((event) => {
      switch (event.type) {
        case EventType.Connected:
          store.dispatch(
            setConnectionState({ type: ConnectionStateType.Connected })
          );
          break;
        case EventType.Disconnected:
          store.dispatch(
            setConnectionState({
              type: ConnectionStateType.Disconnected,
              error: event.error,
            })
          );
          break;
        case EventType.Connecting:
          store.dispatch(
            setConnectionState({ type: ConnectionStateType.Connecting })
          );
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
