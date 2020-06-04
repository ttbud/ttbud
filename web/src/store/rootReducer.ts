import characterTrayReducer from "../ui/tray/character-tray-slice";
import floorTrayReducer from "../ui/tray/floor-tray-slice";
import appReducer from "../ui/app/app-slice";
import boardReducer from "../ui/board/board-slice";
import dragReducer from "../drag/drag-slice";
import connectionStateReducer from "../ui/connection-state/connection-state-slice";
import settingsReducer from "../ui/settings/settings-slice";
import { combineReducers } from "@reduxjs/toolkit";
import { persistReducer } from "redux-persist";
import { persistConfig } from "./persistConfig";

const reducers = combineReducers({
  characterTray: characterTrayReducer,
  floorTray: floorTrayReducer,
  app: appReducer,
  settings: settingsReducer,
  board: boardReducer,
  drag: dragReducer,
  connectionState: connectionStateReducer,
});

export type RootState = ReturnType<typeof reducers>;

const rootReducer = persistReducer(persistConfig, reducers);
export default rootReducer;
