import { DEFAULT_CHARACTER_ICONS } from "../../icons";
import Character2 from "./Character2";
import { ContentType, IconContents } from "../../../types";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import React, { useState } from "react";
import Draggable2 from "./Draggable2";
import { LocationType } from "../../../drag/DragStateTypes";

const ICON = DEFAULT_CHARACTER_ICONS[0];
const DEFAULT_PROPS = {
  id: "character-id",
  contents: { type: ContentType.Icon, iconId: ICON.id } as IconContents,
};

const CharacterWrapper: React.FC<React.ComponentProps<typeof Character2>> = (
  props
) => {
  const [dragging, setDragging] = useState(false);
  const onDragStart = () => {
    setDragging(true);
  };
  const onDragEnd = () => {
    setDragging(false);
  };

  return (
    <DndContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <Draggable2
        id="character-id"
        descriptor={{
          contents: { type: ContentType.Icon, iconId: ICON.id },
          origin: {
            containerId: "unknown",
            location: { type: LocationType.List, idx: 0 },
          },
        }}
      >
        <Character2 {...props} />
      </Draggable2>
      <DragOverlay>{dragging && <Character2 {...props} />}</DragOverlay>
    </DndContext>
  );
};

const characterFixtures = {
  Default: <CharacterWrapper {...DEFAULT_PROPS} />,
  Text: (
    <CharacterWrapper
      {...DEFAULT_PROPS}
      contents={{ type: ContentType.Text, text: "LP" }}
    />
  ),
  Colored: (
    <CharacterWrapper
      {...DEFAULT_PROPS}
      color={{ red: 255, green: 0, blue: 0 }}
    />
  ),
};

export default characterFixtures;
