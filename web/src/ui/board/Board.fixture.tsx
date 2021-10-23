import boardReducer, { INITIAL_STATE } from "./board-slice";
import floorTrayReducer from "../tray/floor-tray-slice";
import Board from "./Board";
import { DndContext, DragStartEvent } from "@dnd-kit/core";
import TtbudTheme from "../TtbudTheme";
import React, { CSSProperties, useCallback, useState } from "react";
import TokenDragOverlay from "../drag/TokenDragOverlay";
import { DragDescriptor } from "../drag/types";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { createBoardState } from "./board-state";
import { v4 as uuid } from "uuid";
import { ContentType, EntityType } from "../../types";

const boardContainerStyle: CSSProperties = { width: 1000, height: 1000 };

const ExampleBoard: React.FC = () => {
  const [activeItem, setActiveItem] = useState<DragDescriptor>();

  const onDragStart = (event: DragStartEvent) => {
    const contents = event.active.data.current as DragDescriptor;
    setActiveItem(contents);
  };

  const onDragEnd = useCallback(() => setActiveItem(undefined), []);

  return (
    <DndContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div style={boardContainerStyle}>
        <Board />
      </div>
      <TokenDragOverlay activeItem={activeItem} />
    </DndContext>
  );
};

const store = configureStore({
  reducer: { board: boardReducer, floorTray: floorTrayReducer },
  preloadedState: {
    board: {
      ...INITIAL_STATE,
      local: createBoardState([
        {
          id: uuid(),
          pos: { x: 0, y: 0, z: 1 },
          contents: { type: ContentType.Text, text: "TS" },
          type: EntityType.Character,
        },
      ]),
    },
  },
});

export default (
  <Provider store={store}>
    <TtbudTheme>
      <ExampleBoard />
    </TtbudTheme>
  </Provider>
);
