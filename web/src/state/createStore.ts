import {
  Action,
  configureStore,
  getDefaultMiddleware,
  ThunkAction
} from "@reduxjs/toolkit";
import { DroppableMonitor } from "../drag/DroppableMonitor";
import rootReducer, { RootState } from "./rootReducer";

interface ThunkExtras {
  monitor: DroppableMonitor;
}

export default function createStore(monitor: DroppableMonitor) {
  const store = configureStore({
    reducer: rootReducer,
    middleware: getDefaultMiddleware({ thunk: { extraArgument: { monitor } } }),
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
