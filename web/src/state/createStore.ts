import {
  Action,
  configureStore,
  getDefaultMiddleware,
  ThunkAction
} from "@reduxjs/toolkit";
import { DroppableMonitor } from "../drag/DroppableMonitor";
import rootReducer, { RootState } from "./rootReducer";
import { BoardStateApiClient } from "../network/BoardStateApiClient";
import { boardSyncer } from "./boardSyncer";

interface ThunkExtras {
  monitor: DroppableMonitor;
}

export default function createStore(
  monitor: DroppableMonitor,
  apiClient: BoardStateApiClient
) {
  const store = configureStore({
    reducer: rootReducer,
    middleware: [
      boardSyncer(apiClient),
      ...getDefaultMiddleware({ thunk: { extraArgument: { monitor } } })
    ],
    devTools: process.env.NODE_ENV === "development"
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
