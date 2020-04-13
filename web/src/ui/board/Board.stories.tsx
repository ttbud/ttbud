import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import React from "react";
import { Provider, useSelector } from "react-redux";
import { v4 as uuid } from "uuid";
import DndContext from "../../drag/DndContext";
import dragReducer from "../../drag/drag-slice";
import { DragStateType } from "../../drag/DragStateTypes";
import { DomDroppableMonitor } from "../../drag/DroppableMonitor";
import { IconToken, TokenType } from "../../network/BoardStateApiClient";
import { RootState } from "../../store/rootReducer";
import noop from "../../util/noop";
import { Icon, ICONS, WALL_ICON } from "../icons";
import noBorder from "../__stories__/no-border";
import { PureBoard as Board } from "./Board";

export default {
  component: Board,
  title: "Board",
  decorators: [noBorder],
};

const toToken = (icon: Icon, i: number): IconToken => ({
  type: i % 2 ? TokenType.Floor : TokenType.Character,
  pos: {
    x: i,
    y: i,
    z: i % 2 ? 0 : 1,
  },
  id: uuid(),
  iconId: icon.id,
});

const tokens = ICONS.take(6).map(toToken).toArray();

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
    <div style={{ width: "100vw", height: "100vh" }}>
      <Board
        isDragging={isDragging}
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
