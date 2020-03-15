import React from "react";
import CharacterTray from "./CharacterTray";
import dragReducer from "../../drag/drag-slice";
import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import { DomDroppableMonitor } from "../../drag/DroppableMonitor";
import { Provider } from "react-redux";
import DndContext from "../../drag/DndContext";
import { ICONS, DEFAULT_CHARACTER_ICONS } from "../icons";
import noop from "../../util/noop";

export default {
  component: CharacterTray,
  title: "CharacterTray"
};

const monitor = new DomDroppableMonitor();
const store = configureStore({
  reducer: { drag: dragReducer },
  middleware: getDefaultMiddleware({ thunk: { extraArgument: { monitor } } })
});

export const Default: React.FC = () => (
  <Provider store={store}>
    <DndContext.Provider value={monitor}>
      <div
        style={{
          display: "inline-block",
          position: "absolute",
          left: 0,
          top: 0
        }}
      >
        <CharacterTray icons={DEFAULT_CHARACTER_ICONS} onIconRemoved={noop} />
      </div>
    </DndContext.Provider>
  </Provider>
);
