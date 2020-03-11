import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import React from "react";
import { Provider } from "react-redux";
import DndContext from "../../drag/DndContext";
import dragReducer from "../../drag/drag-slice";
import { DomDroppableMonitor } from "../../drag/DroppableMonitor";
import noop from "../../util/noop";
import { ICONS, IconType, WALL_ICON } from "../icons";
import FloorTray from "./FloorTray";

export default {
  component: FloorTray,
  title: "FloorTray"
};

const monitor = new DomDroppableMonitor();
const store = configureStore({
  reducer: { drag: dragReducer },
  middleware: getDefaultMiddleware({ thunk: { extraArgument: { monitor } } })
});

const icons = ICONS.filter(icon => icon.type === IconType.floor)
  .take(5)
  .toArray();

export const Default: React.FC = () => (
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
          transform: "translateX(-50%)"
        }}
      >
        <FloorTray
          icons={icons}
          activeFloor={WALL_ICON}
          onFloorSelected={noop}
          onFloorRemoved={noop}
        />
      </div>
    </DndContext.Provider>
  </Provider>
);
