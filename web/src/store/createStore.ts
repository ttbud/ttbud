import {
  Action,
  configureStore,
  getDefaultMiddleware,
  ThunkAction,
} from "@reduxjs/toolkit";
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
} from "redux-persist";
import { DroppableMonitor } from "../drag/DroppableMonitor";
import { BoardStateApiClient } from "../network/BoardStateApiClient";
import { networkSyncer } from "../network/networkSyncer";
import rootReducer, { RootState } from "./rootReducer";
import debugLog from "./debugLog";

interface ThunkExtras {
  monitor: DroppableMonitor;
}

export default function createStore(
  monitor: DroppableMonitor,
  apiClient: BoardStateApiClient
) {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: {},
    middleware: [
      debugLog,
      networkSyncer(apiClient),
      ...getDefaultMiddleware({
        thunk: { extraArgument: { monitor } },
        // redux-persist uses non-serializable actions, and that's core to how it works :(.
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
      }),
    ],
    devTools: process.env.NODE_ENV === "development",
  });

  if (process.env.NODE_ENV === "development" && module.hot) {
    module.hot.accept("./rootReducer", () => {
      const newReducer = require("./rootReducer").default;
      store.replaceReducer(newReducer);
    });
  }

  return store;
}

export type AppThunk = ThunkAction<
  void,
  RootState,
  ThunkExtras,
  Action<string>
>;
