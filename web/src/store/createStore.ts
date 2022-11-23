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
import BoardStateApiClient from "../network/BoardStateApiClient";
import { networkSyncMiddleware } from "../network/networkSyncMiddleware";
import rootReducer, { RootState } from "./rootReducer";

export default function createStore(apiClient: BoardStateApiClient) {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: {},
    middleware: [
      networkSyncMiddleware(apiClient),
      ...getDefaultMiddleware({
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

export type AppThunk = ThunkAction<void, RootState, {}, Action<string>>;
