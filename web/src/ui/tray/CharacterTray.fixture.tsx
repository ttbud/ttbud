import React from "react";
import dragReducer from "../../drag/drag-slice";
import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import { DomDroppableMonitor } from "../../drag/DroppableMonitor";
import { Provider } from "react-redux";
import DndContext from "../../drag/DndContext";
import { DEFAULT_CHARACTER_ICONS } from "../icons";
import noop from "../../util/noop";
import { PureCharacterTray as CharacterTray } from "./CharacterTray";
import { ContentType, TokenContents } from "../../types";

const monitor = new DomDroppableMonitor();
const store = configureStore({
  reducer: { drag: dragReducer },
  middleware: getDefaultMiddleware({ thunk: { extraArgument: { monitor } } }),
});

const sources: TokenContents[] = DEFAULT_CHARACTER_ICONS.map((icon) => ({
  type: ContentType.Icon,
  iconId: icon.id,
}));

export default (
  <Provider store={store}>
    <DndContext.Provider value={monitor}>
      <div
        style={{
          display: "inline-block",
          position: "absolute",
          left: 0,
          top: 0,
        }}
      >
        <CharacterTray sources={sources} onSourceRemoved={noop} />
      </div>
    </DndContext.Provider>
  </Provider>
);
