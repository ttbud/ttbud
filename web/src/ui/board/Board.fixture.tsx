import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import React from "react";
import { Provider, useSelector } from "react-redux";
import { v4 as uuid } from "uuid";
import DndContext from "../../drag/DndContext";
import dragReducer from "../../drag/drag-slice";
import { DragStateType } from "../../drag/DragStateTypes";
import { DomDroppableMonitor } from "../../drag/DroppableMonitor";
import { RootState } from "../../store/rootReducer";
import noop from "../../util/noop";
import { Icon, ICONS, WALL_ICON } from "../icons";
import { PureBoard as Board } from "./Board";
import { ContentType, EntityType, Token } from "../../types";

const toToken = (icon: Icon, i: number): Token => ({
  type: i % 2 ? EntityType.Floor : EntityType.Character,
  pos: {
    x: i,
    y: i,
    z: i % 2 ? 0 : 1,
  },
  id: uuid(),
  contents: {
    type: ContentType.Icon,
    iconId: icon.id,
  },
});

const tokens = ICONS.slice(0, 5).map(toToken);

const monitor = new DomDroppableMonitor();
const store = configureStore({
  reducer: {
    drag: dragReducer,
  },
  middleware: getDefaultMiddleware({ thunk: { extraArgument: { monitor } } }),
});

const ExampleBoard: React.FC = () => {
  const isDragging = useSelector(
    (state: RootState) => state.drag.type !== DragStateType.NotDragging
  );

  return (
    // Negative margin to cancel out the body margin because board cannot handle that :(
    <div style={{ width: "100vw", height: "100vh", margin: "-8px" }}>
      <Board
        isDragging={isDragging}
        tokens={tokens}
        activeFloor={{ type: ContentType.Icon, iconId: WALL_ICON.id }}
        onFloorCreated={noop}
        onTokenDeleted={noop}
        onPingCreated={noop}
      />
    </div>
  );
};

export default (
  <Provider store={store}>
    <DndContext.Provider value={monitor}>
      <ExampleBoard />
    </DndContext.Provider>
  </Provider>
);
