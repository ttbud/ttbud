import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import React from "react";
import { Provider, useSelector } from "react-redux";
import DndContext from "../../drag/DndContext";
import dragReducer from "../../drag/drag-slice";
import { DragStateType } from "../../drag/DragStateTypes";
import { DomDroppableMonitor } from "../../drag/DroppableMonitor";
import { RootState } from "../../store/rootReducer";
import noop from "../../util/noop";
import { WALL_ICON } from "../icons";
import { PureBoard as Board } from "./Board";
import { ContentType } from "../../types";

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
        activeFloor={{ type: ContentType.Icon, iconId: WALL_ICON.id }}
        onFloorCreated={noop}
        onTokenDeleted={noop}
        onPingCreated={noop}
        onUndoPressed={noop}
        onUndoFenceHit={noop}
        onRedoPressed={noop}
        boardState={{
          entityById: {},
          tokenIdsByPosStr: {},
          charIdsByContentId: {},
        }}
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
