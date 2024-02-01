import Draggable from "./Draggable";
import DraggableSquare from "../ui/__stories__/DragAwareSquare";
import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import dragReducer from "./drag-slice";
import { Provider, useSelector } from "react-redux";
import { DomDroppableMonitor } from "./DroppableMonitor";
import { DraggableType, DragStateType } from "./DragStateTypes";
import DndContext from "./DndContext";
import { ContentType } from "../types";
import { WALL_ICON } from "../ui/icons";
import { RootState } from "../store/rootReducer";
import { useEffect } from "react";

const monitor = new DomDroppableMonitor();
const store = configureStore({
  reducer: {
    drag: dragReducer,
  },
  middleware: getDefaultMiddleware({ thunk: { extraArgument: { monitor } } }),
});

export default function DraggableFixture() {
  return (
    <Provider store={store}>
      <DndContext.Provider value={monitor}>
        <Example />
      </DndContext.Provider>
    </Provider>
  );
}

function Example() {
  const isDragging = useSelector((state: RootState) => {
    return state.drag.type !== DragStateType.NotDragging;
  });
  useEffect(() => {
    const onPointerMove = () => {
      console.log("external pointermove");
    };

    console.log("adding external pointermove");
    window.addEventListener("pointermove", onPointerMove);

    return () => {
      console.log("removing external pointermove");
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return (
    <>
      {!isDragging && (
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
      )}
      {isDragging && (
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
      )}
    </>
  );
}
