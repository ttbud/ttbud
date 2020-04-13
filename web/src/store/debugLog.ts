import { Middleware } from "@reduxjs/toolkit";
import { RootState } from "./rootReducer";
import logger from "redux-logger";

const debugLog: Middleware = (store) => (next) => (action) => {
  const state: RootState = store.getState();
  if (state.app.debug) {
    return logger(store)(next)(action);
  } else {
    return next(action);
  }
};

export default debugLog;
