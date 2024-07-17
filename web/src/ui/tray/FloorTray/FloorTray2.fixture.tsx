import { DndContext, DragOverlay, DragStartEvent } from "@dnd-kit/core";
import FloorTray2 from "./FloorTray2";
import { ICONS } from "../../icons";
import { Blueprint } from "../CharacterTray/CharacterTray2";
import { LocationType } from "../../../drag/DragStateTypes";
import { ContentType, TokenContents } from "../../../types";
import { useState } from "react";
import FloorButton from "../FloorButton";
import { assert } from "../../../util/invariants";
import restrictToFloorTray from "../floorTrayDragsModifier";
import noop from "../../../util/noop";

function dec2hex(dec: number) {
  return dec.toString(16).padStart(2, "0");
}

function randSuffix() {
  const arr = new Uint8Array(5 / 2);
  crypto.getRandomValues(arr);
  return Array.from(arr, dec2hex).join("");
}

const blueprints: Blueprint[] = ICONS.slice(0, 5).map((icon, i) => ({
  id: `${icon.id}-${randSuffix()}`,
  contents: { iconId: icon.id, type: ContentType.Icon },
}));

const firstBlueprint = blueprints[0];

const FloorTray2Fixture: React.FC = () => {
  const [dragContent, setDragContent] = useState<TokenContents>();

  const onDragStart = ({ active: { data } }: DragStartEvent) => {
    const contents = data.current?.contents as TokenContents | undefined;
    assert(contents !== undefined, "No data set on draggable");
    setDragContent(contents);
    console.log(contents);
  };

  const onDragEnd = () => {
    setDragContent(undefined);
  };

  return (
    <DndContext
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      modifiers={[restrictToFloorTray]}
    >
      <FloorTray2
        activeFloor={firstBlueprint}
        blueprints={blueprints}
        onFloorSelected={noop}
      />
      <DragOverlay>
        {dragContent && <FloorButton contents={dragContent} selected={true} />}
      </DragOverlay>
    </DndContext>
  );
};

export default FloorTray2Fixture;
