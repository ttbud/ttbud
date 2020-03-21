import characterTrayReducer from "./character-tray-slice";
import floorTrayReducer from "./floor-tray-slice";
import appReducer from "./app-slice";
import boardReducer from "./board-slice";
import dragReducer from "../drag/drag-slice";
import { combineReducers } from "@reduxjs/toolkit";
import { persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";

const reducers = combineReducers({
  characterTray: characterTrayReducer,
  floorTray: floorTrayReducer,
  app: appReducer,
  board: boardReducer,
  drag: dragReducer,
});

export type RootState = ReturnType<typeof reducers>;

const persistConfig = {
  key: "settings",
  storage,
  whitelist: ["characterTray", "floorTray"],
};

const rootReducer = persistReducer(persistConfig, reducers);
export default rootReducer;
