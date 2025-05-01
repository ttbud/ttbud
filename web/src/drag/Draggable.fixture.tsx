import Draggable from "./Draggable";
import DraggableSquare from "../ui/__stories__/DragAwareSquare";
import { configureStore } from "@reduxjs/toolkit";
import dragReducer from "./drag-slice";
import { Provider } from "react-redux";
import { DomDroppableMonitor } from "./DroppableMonitor";
import { DraggableType } from "./DragStateTypes";
import DndContext from "./DndContext";
import { ContentType } from "../types";
import { WALL_ICON } from "../ui/icons";

const monitor = new DomDroppableMonitor();
const store = configureStore({
  reducer: {
    drag: dragReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ thunk: { extraArgument: { monitor } } }),
});

export default function DraggableFixture() {
  return (
    <Provider store={store}>
      <DndContext.Provider value={monitor}>
        <Draggable
          descriptor={{
            type: DraggableType.TokenBlueprint,
            id: "draggable",
            contents: { type: ContentType.Icon, iconId: WALL_ICON.id },
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
}
