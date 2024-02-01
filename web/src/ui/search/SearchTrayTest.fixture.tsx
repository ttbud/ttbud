import SearchTray from "./SearchTray";
import { ICONS, WALL_ICON } from "../icons";
import { DomDroppableMonitor } from "../../drag/DroppableMonitor";
import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import dragReducer from "../../drag/drag-slice";
import { Provider, useSelector } from "react-redux";
import DndContext from "../../drag/DndContext";
import noop from "../../util/noop";
import { RootState } from "../../store/rootReducer";
import { DragStateType } from "../../drag/DragStateTypes";
import { PureBoard as Board } from "../board/Board";
import { ContentType } from "../../types";
import useWindowSize from "../util/useWindowSize";
import { useState } from "react";

const monitor = new DomDroppableMonitor();
const store = configureStore({
  reducer: {
    drag: dragReducer,
  },
  middleware: getDefaultMiddleware({
    thunk: {
      extraArgument: { monitor },
    },
  }),
});

const ExampleBoard: React.FC = () => {
  const isDragging = useSelector(
    (state: RootState) => state.drag.type !== DragStateType.NotDragging
  );

  return (
    <Board
      isDragging={isDragging}
      activeFloor={{ type: ContentType.Icon, iconId: WALL_ICON.id }}
      onFloorCreated={noop}
      onTokenDeleted={noop}
      onPingCreated={noop}
      boardState={{
        entityById: {},
        tokenIdsByPosStr: {},
        charIdsByContentId: {},
      }}
    />
  );
};

const ExampleSearchTray: React.FC = () => {
  const windowSize = useWindowSize();
  const searchTrayWidthPx = Math.min(300, windowSize.width);
  const open = true;
  // const [open, setOpen] = useState(false);
  // const onSearchClicked = () => {
  //   setOpen(!open);
  // };

  const isDragging = useSelector(
    (state: RootState) => state.drag.type !== DragStateType.NotDragging
  );

  return (
    <div
      style={{
        position: "fixed",
        zIndex: 3,
        width: searchTrayWidthPx,
        height: "100%",
        left: open && !isDragging ? 0 : -searchTrayWidthPx,
        top: 0,
        transition: "left 250ms",
      }}
    >
      <SearchTray icons={ICONS} open={true} onSearchClicked={noop} />
    </div>
  );
};

export default (
  <Provider store={store}>
    <DndContext.Provider value={monitor}>
      {/** Negative margin to cancel out the body margin because board cannot handle that :(*/}
      {/*<div style={{ width: "4000px", height: "2000px", margin: "-8px" }}>*/}
      {/*  <ExampleBoard />*/}
      <ExampleSearchTray />
      {/*</div>*/}
    </DndContext.Provider>
  </Provider>
);
