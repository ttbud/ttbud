import React from "react";
import Draggable from "./Draggable";
import DraggableSquare from "../__stories__/DragAwareSquare";
import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import dragReducer from "../../state/drag-slice";
import { Provider } from "react-redux";
import { DomDroppableMonitor } from "./DroppableMonitor";
import { DraggableType } from "./DragStateTypes";
import { WALL_ICON } from "../icons";
import DndContext from "./DndContext";

export default {
  component: Draggable,
  title: "Draggable"
};

const monitor = new DomDroppableMonitor();
const store = configureStore({
  reducer: {
    drag: dragReducer
  },
  middleware: getDefaultMiddleware({ thunk: { extraArgument: { monitor } } })
});
export const Default = () => (
  <Provider store={store}>
    <DndContext.Provider value={monitor}>
      <Draggable
        descriptor={{
          type: DraggableType.ICON,
          id: "draggable",
          icon: WALL_ICON
        }}
      >
        {(isDragging, attributes) => (
          <DraggableSquare
            isDragging={isDragging}
            color={"red"}
            {...attributes}
          />
        )}
      </Draggable>
    </DndContext.Provider>
  </Provider>
);
