import characterTrayReducer from "./character-tray-slice";
import floorTrayReducer from "./floor-tray-slice";
import appReducer from "./app-slice";
import boardReducer from "./board-slice";
import dragReducer from "../drag/drag-slice";
import { combineReducers } from "@reduxjs/toolkit";

const rootReducer = combineReducers({
  characterTray: characterTrayReducer,
  floorTray: floorTrayReducer,
  app: appReducer,
  board: boardReducer,
  drag: dragReducer
});

export type RootState = ReturnType<typeof rootReducer>;

export default rootReducer;
