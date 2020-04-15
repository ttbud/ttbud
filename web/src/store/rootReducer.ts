import characterTrayReducer from "../ui/tray/character-tray-slice";
import floorTrayReducer from "../ui/tray/floor-tray-slice";
import appReducer from "../ui/app/app-slice";
import boardReducer from "../ui/board/board-slice";
import dragReducer from "../drag/drag-slice";
import connectionStateReducer from "../ui/connection-state/connection-state-slice";
import { combineReducers } from "@reduxjs/toolkit";
import { persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";

const reducers = combineReducers({
  characterTray: characterTrayReducer,
  floorTray: floorTrayReducer,
  app: appReducer,
  board: boardReducer,
  drag: dragReducer,
  connectionState: connectionStateReducer,
});

export type RootState = ReturnType<typeof reducers>;

const persistConfig = {
  key: "settings",
  storage,
  whitelist: ["characterTray", "floorTray"],
};

const rootReducer = persistReducer(persistConfig, reducers);
export default rootReducer;
