import Draggable from "./Draggable";
import Droppable from "./Droppable";
import Square from "../ui/__stories__/Square";
import DraggableSquare from "../ui/__stories__/DragAwareSquare";
import { configureStore } from "@reduxjs/toolkit";
import dragReducer from "./drag-slice";
import { Provider, useSelector } from "react-redux";
import { DomDroppableMonitor } from "./DroppableMonitor";
import UnreachableCaseError from "../util/UnreachableCaseError";
import { DraggableType, DragStateType } from "./DragStateTypes";
import DndContext from "./DndContext";
import { RootState } from "../store/rootReducer";
import { ContentType } from "../types";
import { WALL_ICON } from "../ui/icons";

const monitor = new DomDroppableMonitor();
const store = configureStore({
  reducer: { drag: dragReducer },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ thunk: { extraArgument: { monitor } } }),
});

const ColoredDroppable: React.FC<{ color: string }> = ({ color }) => (
  <Droppable id={color} getLocation={() => undefined}>
    {(attributes) => <Square {...attributes} color={color} />}
  </Droppable>
);

const DropTargets: React.FC = () => {
  const message = useSelector((state: RootState) => {
    const dragState = state.drag;
    switch (dragState.type) {
      case DragStateType.NotDragging:
        return "Not Dragging";
      case DragStateType.Dragging:
        return dragState.hoveredDroppableId
          ? `Hovering over ${dragState.hoveredDroppableId}`
          : "Dragging";
      case DragStateType.DragEndAnimating:
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
          type: DraggableType.TokenBlueprint,
          id: "draggable",
          contents: { type: ContentType.Icon, iconId: WALL_ICON.id },
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

export default function DroppableFixture() {
  return (
    <Provider store={store}>
      <DndContext.Provider value={monitor}>
        <DropTargets />
      </DndContext.Provider>
    </Provider>
  );
}
