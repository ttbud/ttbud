import SearchDialog from "./SearchDialog";
import { ICONS } from "../icons";
import noop from "../../util/noop";
import TtbudTheme from "../TtbudTheme";
import { DndContext } from "@dnd-kit/core";
import React, { useState } from "react";
import { DragDescriptor } from "../drag/types";
import { DragStartEvent } from "@dnd-kit/core/dist/types";
import TokenDragOverlay from "../drag/TokenDragOverlay";

const ExampleSearchDialog: React.FC = () => {
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
          position: "absolute",
          width: 300,
          height: "100%",
          left: 0,
          top: 0,
        }}
      >
        <SearchDialog icons={ICONS} open={true} onClose={noop} />
      </div>
      <TokenDragOverlay activeItem={activeItem} />
    </DndContext>
  );
};

export default (
  <TtbudTheme>
    <ExampleSearchDialog />
  </TtbudTheme>
);
