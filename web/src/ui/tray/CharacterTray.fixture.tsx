import characterTrayReducer from "./character-tray-slice";
import CharacterTray from "./CharacterTray";
import { DndContext } from "@dnd-kit/core";
import TtbudTheme from "../TtbudTheme";
import TokenDragOverlay from "../drag/TokenDragOverlay";
import React, { useState } from "react";
import { DragStartEvent } from "@dnd-kit/core/dist/types";
import { DragDescriptor } from "../drag/types";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";

const ExampleCharacterTray: React.FC = () => {
  const [activeItem, setActiveItem] = useState<DragDescriptor>();

  const onDragStart = (event: DragStartEvent) => {
    const contents = event.active.data.current as DragDescriptor;
    setActiveItem(contents);
  };

  const onDragEnd = () => setActiveItem(undefined);

  return (
    <DndContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div
        style={{
          display: "inline-block",
          position: "absolute",
          left: 0,
          top: 0,
        }}
      >
        <CharacterTray />
      </div>

      <TokenDragOverlay activeItem={activeItem} />
    </DndContext>
  );
};

const store = configureStore({
  reducer: { characterTray: characterTrayReducer },
});

export default (
  <Provider store={store}>
    <TtbudTheme>
      <ExampleCharacterTray />
    </TtbudTheme>
  </Provider>
);
