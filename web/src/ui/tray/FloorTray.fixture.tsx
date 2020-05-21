import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import React from "react";
import { Provider } from "react-redux";
import DndContext from "../../drag/DndContext";
import dragReducer from "../../drag/drag-slice";
import { DomDroppableMonitor } from "../../drag/DroppableMonitor";
import noop from "../../util/noop";
import { DEFAULT_FLOOR_ICONS } from "../icons";
import { PureFloorTray as FloorTray } from "./FloorTray";
import { ContentType, TokenContents } from "../../types";

const monitor = new DomDroppableMonitor();
const store = configureStore({
  reducer: { drag: dragReducer },
  middleware: getDefaultMiddleware({ thunk: { extraArgument: { monitor } } }),
});

const sources: TokenContents[] = DEFAULT_FLOOR_ICONS.map((icon) => ({
  type: ContentType.Icon,
  iconId: icon.id,
}));

export default (
  <Provider store={store}>
    <DndContext.Provider value={monitor}>
      <div
        style={{
          display: "inline-flex",
          position: "fixed",
          zIndex: 2,
          // Same location whether the scrollbar is visible or not
          // (Scrollbar width = 100vh - 100%)
          bottom: `calc(10px - (100vh - 100%))`,
          left: "calc(50% + (100vw - 100%)/2)",
          transform: "translateX(-50%)",
        }}
      >
        <FloorTray
          sources={sources}
          activeFloor={sources[0]}
          onFloorSelected={noop}
          onFloorRemoved={noop}
        />
      </div>
    </DndContext.Provider>
  </Provider>
);
