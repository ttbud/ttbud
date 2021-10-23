import floorTrayReducer from "./floor-tray-slice";
import { DEFAULT_FLOOR_ICONS } from "../icons";
import FloorTray from "./FloorTray";
import { ContentType, TokenContents } from "../../types";
import React, { useState } from "react";
import { DndContext } from "@dnd-kit/core";
import TokenDragOverlay from "../drag/TokenDragOverlay";
import { DragStartEvent } from "@dnd-kit/core/dist/types";
import { DragDescriptor } from "../drag/types";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { containFloorsModifier } from "./containFloorsModifier";

const blueprints: TokenContents[] = DEFAULT_FLOOR_ICONS.map((icon) => ({
  type: ContentType.Icon,
  iconId: icon.id,
}));

const modifiers = [containFloorsModifier, restrictToWindowEdges];

const ExampleFloorTray: React.FC = () => {
  const [activeItem, setActiveItem] = useState<DragDescriptor>();

  const onDragStart = (event: DragStartEvent) => {
    const contents = event.active.data.current as DragDescriptor;
    setActiveItem(contents);
  };

  const onDragEnd = () => setActiveItem(undefined);

  return (
    <DndContext
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      modifiers={modifiers}
    >
      <div style={{ width: "100vw", height: "100vh" }}>
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            margin: "0 8px 8px 0",
            width: "100%",
            zIndex: 2,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <FloorTray />
        </div>
      </div>
      <TokenDragOverlay activeItem={activeItem} />
    </DndContext>
  );
};

const store = configureStore({
  reducer: { floorTray: floorTrayReducer },
});

export default (
  <Provider store={store}>
    <ExampleFloorTray />
  </Provider>
);
