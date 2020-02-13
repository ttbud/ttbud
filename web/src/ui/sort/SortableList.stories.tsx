import React from "react";
import DraggableSquare from "../__stories__/DragAwareSquare";
import SortableList, { DraggableItem } from "./SortableList";
import { DomDroppableMonitor } from "../drag/DroppableMonitor";
import { Provider, useSelector } from "react-redux";
import {
  configureStore,
  createSlice,
  getDefaultMiddleware,
  PayloadAction
} from "@reduxjs/toolkit";
import dragReducer, { DragEndAction, dragEnded } from "../../state/drag-slice";
import { assert } from "../../util/invariants";
import { DraggableType, LocationType } from "../drag/DragStateTypes";
import { WALL_ICON } from "../icons";
import DndContext from "../drag/DndContext";

export default {
  component: SortableList,
  title: "SortableList"
};

const monitor = new DomDroppableMonitor();

function coloredDraggableItem(color: string): DraggableItem {
  return {
    descriptor: {
      id: `${color}`,
      type: DraggableType.ICON,
      icon: WALL_ICON
    }
  };
}

const sortSlice = createSlice({
  name: "sort",
  initialState: [
    coloredDraggableItem("red"),
    coloredDraggableItem("green"),
    coloredDraggableItem("blue")
  ],
  reducers: {},
  extraReducers: {
    [dragEnded.type]: (
      state: DraggableItem[],
      action: PayloadAction<DragEndAction>
    ) => {
      const { source, destination } = action.payload;
      assert(
        source.logicalLocation?.type === LocationType.LIST,
        "Drag started from outside sortable list"
      );
      assert(
        destination.logicalLocation?.type === LocationType.LIST,
        "Drag ended outside sortable list"
      );
      const startIdx = source.logicalLocation.idx;
      const endIdx = destination.logicalLocation.idx;
      if (endIdx === startIdx) {
        return;
      }

      const [removed] = state.splice(startIdx, 1);
      state.splice(endIdx, 0, removed);
    }
  }
});

const store = configureStore({
  reducer: { drag: dragReducer, sort: sortSlice.reducer },
  middleware: getDefaultMiddleware({ thunk: { extraArgument: { monitor } } })
});

const ColorList = () => {
  const squares = useSelector((state: { sort: DraggableItem[] }) => state.sort);
  return (
    <div
      style={{
        backgroundColor: "gray",
        display: "inline-block",
        padding: "10px"
      }}
    >
      <SortableList id={"droppable-list"} items={squares}>
        {(square, isDragging, attributes) => (
          <DraggableSquare
            key={square.descriptor.id}
            isDragging={isDragging}
            color={square.descriptor.id}
            {...attributes}
          />
        )}
      </SortableList>
    </div>
  );
};

export const Default: React.FC = () => (
  <DndContext.Provider value={monitor}>
    <Provider store={store}>
      <ColorList />
    </Provider>
  </DndContext.Provider>
);
