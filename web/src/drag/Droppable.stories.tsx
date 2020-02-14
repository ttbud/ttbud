import React from "react";
import Draggable from "./Draggable";
import Droppable from "./Droppable";
import Square from "../ui/__stories__/Square";
import DraggableSquare from "../ui/__stories__/DragAwareSquare";
import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import dragReducer from "./drag-slice";
import { Provider, useSelector } from "react-redux";
import { DomDroppableMonitor } from "./DroppableMonitor";
import UnreachableCaseError from "../util/UnreachableCaseError";
import { DraggableType, DragStateType } from "./DragStateTypes";
import { WALL_ICON } from "../ui/icons";
import DndContext from "./DndContext";
import { RootState } from "../state/rootReducer";

export default {
  component: Droppable,
  title: "Droppable"
};

const monitor = new DomDroppableMonitor();
const store = configureStore({
  reducer: { drag: dragReducer },
  middleware: getDefaultMiddleware({ thunk: { extraArgument: { monitor } } })
});

const ColoredDroppable: React.FC<{ color: string }> = ({ color }) => (
  <Droppable id={color} getLocation={() => undefined}>
    {attributes => <Square {...attributes} color={color} />}
  </Droppable>
);

const DropTargets: React.FC = () => {
  const message = useSelector((state: RootState) => {
    const dragState = state.drag;
    switch (dragState.type) {
      case DragStateType.NOT_DRAGGING:
        return "Not Dragging";
      case DragStateType.DRAGGING:
        return dragState.hoveredDroppableId
          ? `Hovering over ${dragState.hoveredDroppableId}`
          : "Dragging";
      case DragStateType.DRAG_END_ANIMATING:
        return "Drag End Animating";
      default:
        return new UnreachableCaseError(dragState);
    }
  });

  return (
    <>
      <div>{message}</div>
      <ColoredDroppable color="red" />
      <ColoredDroppable color="green" />
      <Draggable
        descriptor={{
          type: DraggableType.ICON,
          id: "draggable",
          icon: WALL_ICON
        }}
      >
        {(isDragging, attributes) => (
          <DraggableSquare
            color="blue"
            isDragging={isDragging}
            {...attributes}
          />
        )}
      </Draggable>
    </>
  );
};

export const Default = () => (
  <Provider store={store}>
    <DndContext.Provider value={monitor}>
      <DropTargets />
    </DndContext.Provider>
  </Provider>
);
