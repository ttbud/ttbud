import { Blueprint } from "./CharacterTray2";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import SortableItem from "./SortableItem";
import { Paper } from "@material-ui/core";
import FloorButton from "./FloorButton";
import { LocationType } from "../../drag/DragStateTypes";
import { useDroppable } from "@dnd-kit/core";
import { shallowEqual } from "react-redux";
import { memo } from "react";

interface Props {
  blueprints: Blueprint[];
  activeFloor: Blueprint;
}

const FloorTray2: React.FC<Props> = memo(({ blueprints, activeFloor }) => {
  return (
    <Paper
      data-tour="floor-tray"
      aria-label="Floor Tray"
      style={{
        display: "flex",
        flexDirection: "row",
      }}
    >
      <SortableContext
        id={"floor-tray"}
        items={blueprints}
        strategy={horizontalListSortingStrategy}
      >
        {blueprints.map((blueprint, idx) => (
          <SortableItem
            id={blueprint.id}
            key={blueprint.id}
            descriptor={{
              contents: blueprint.contents,
              origin: {
                containerId: "floor-tray",
                location: { type: LocationType.List, idx },
              },
            }}
          >
            <FloorButton
              contents={blueprint.contents}
              selected={activeFloor.id === blueprint.id}
            />
          </SortableItem>
        ))}
      </SortableContext>
    </Paper>
  );
}, shallowEqual);

export default FloorTray2;
