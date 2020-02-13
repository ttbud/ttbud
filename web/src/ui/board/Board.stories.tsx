import React from "react";
import { Icon, ICONS, IconType, WALL_ICON } from "../icons";
import Board from "./Board";
import uuid from "uuid";
import noBorder from "../__stories__/no-border";
import { Provider, useSelector } from "react-redux";
import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import dragReducer from "../../state/drag-slice";
import { DomDroppableMonitor } from "../drag/DroppableMonitor";
import DndContext from "../drag/DndContext";
import noop from "../../util/noop";
import { DragStateType } from "../drag/DragStateTypes";
import { RootState } from "../../state/rootReducer";

export default {
  component: Board,
  title: "Board",
  decorators: [noBorder]
};

const toToken = (icon: Icon, i: number) => ({
  x: i,
  y: i,
  z: icon.type === IconType.floor ? 0 : 1,
  id: uuid(),
  iconId: icon.id
});

const cards = ICONS.filter(icon => icon.type === IconType.token)
  .take(3)
  .map(toToken);
const floors = ICONS.filter(icon => icon.type === IconType.floor)
  .take(3)
  .map(toToken);

const tokens = cards.concat(floors).toArray();

const monitor = new DomDroppableMonitor();
const store = configureStore({
  reducer: {
    drag: dragReducer
  },
  middleware: getDefaultMiddleware({
    thunk: {
      extraArgument: monitor
    }
  })
});

const ExampleBoard: React.FC = () => {
  const isDragging = useSelector(
    (state: RootState) => state.drag.type !== DragStateType.NOT_DRAGGING
  );

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Board
        isDragging={isDragging}
        pings={[]}
        tokens={tokens}
        activeFloor={WALL_ICON}
        onFloorCreated={noop}
        onTokenDeleted={noop}
        onPingCreated={noop}
      />
    </div>
  );
};

export const Default = () => {
  return (
    <Provider store={store}>
      <DndContext.Provider value={monitor}>
        <ExampleBoard />
      </DndContext.Provider>
    </Provider>
  );
};
